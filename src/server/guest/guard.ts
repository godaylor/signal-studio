import { Prisma } from '@/generated/prisma/client';
import type { Auth } from '@/lib/types';
import { requestId as safeRequestId } from '@/server/operations/telemetry';
import { GuestError, GUEST_LIMITS, guestErrorResponse, sameOriginGuestRequest } from './contracts';
import { getGuestDatabase } from './database';

export function guestRouteOperation(request: Request, projectId: string, userId?: string) {
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const method = request.method.toUpperCase();
  const read = method === 'GET';
  if (
    ['/api/auth/verify', '/api/auth/logout', '/api/guest'].includes(path) &&
    (read || method === 'POST')
  )
    return 'session';
  if (read && ['/api/projects', '/api/me', '/api/me/teams'].includes(path)) return 'read';
  if (read && path === `/api/websites/${projectId}`) return 'read';
  if (read && userId && path === `/api/users/${userId}/websites`) return 'read';
  const prefix = `/api/projects/${projectId}`;
  if (path === prefix && read) return 'read';
  if (!path.startsWith(`${prefix}/`)) throw new GuestError('guest-operation-denied', 403);
  const suffix = path.slice(prefix.length + 1);
  if (
    /^(access|home|live|accounts(?:\/[a-f0-9-]+)?|tracked-users(?:\/[a-f0-9-]+)?|evidence)$/.test(
      suffix,
    ) &&
    read
  )
    return 'read';
  if (/^analytics\/(query|drilldown)$/.test(suffix) && method === 'POST') return 'queries';
  if (suffix === 'segments/preview' && method === 'POST') return 'queries';
  if (suffix === 'exports' && method === 'POST') return 'exports';
  if (suffix === 'exports' && read) return 'read';
  if (
    /^(insights|dashboards|segments|cohorts)(?:\/[a-f0-9-]+)?(?:\/duplicate|\/widgets(?:\/[a-f0-9-]+)?)?$/.test(
      suffix,
    )
  ) {
    if (read) return 'read';
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method))
      throw new GuestError('guest-operation-denied', 403);
    if (method === 'POST') {
      if (suffix === 'insights' || suffix.endsWith('/duplicate')) return 'insights';
      if (suffix === 'dashboards') return 'dashboards';
      if (suffix.endsWith('/widgets')) return 'widgets';
      if (suffix === 'segments' || suffix === 'cohorts') return 'segments';
    }
    return 'mutations';
  }
  throw new GuestError('guest-operation-denied', 403);
}

export async function enforceGuestRequest(request: Request, auth: Auth, now = new Date()) {
  if (!auth.guest) return null;
  try {
    if (request.method !== 'GET' && !sameOriginGuestRequest(request))
      throw new GuestError('guest-origin-denied', 403);
    const operation = guestRouteOperation(request, auth.guest.projectId, auth.user.id);
    // Revocation must remain available after every work/query budget is exhausted.
    if (new URL(request.url).pathname === '/api/auth/logout') return null;
    const db = getGuestDatabase();
    const maximum =
      operation in GUEST_LIMITS ? GUEST_LIMITS[operation as keyof typeof GUEST_LIMITS] : null;
    const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE guest_session SET
        window_started_at=CASE WHEN window_started_at <= ${now}::timestamptz - INTERVAL '1 minute' THEN ${now}::timestamptz ELSE window_started_at END,
        window_requests=CASE WHEN window_started_at <= ${now}::timestamptz - INTERVAL '1 minute' THEN 1 ELSE window_requests+1 END,
        lifetime_requests=lifetime_requests+1,
        operations=jsonb_set(operations,ARRAY[${operation}],to_jsonb(COALESCE((operations->>${operation})::integer,0)+1))
      WHERE id=${auth.guest.id}::uuid AND user_id=${auth.user.id}::uuid AND expires_at>${now}
        AND lifetime_requests<${GUEST_LIMITS.lifetimeRequests}
        AND (window_started_at<=${now}::timestamptz - INTERVAL '1 minute' OR window_requests<${GUEST_LIMITS.requestsPerMinute})
        ${maximum === null ? Prisma.empty : Prisma.sql`AND COALESCE((operations->>${operation})::integer,0)<${maximum}`}
      RETURNING id`);
    if (!rows.length) {
      const current = await db.guestSession.findUnique({
        where: { id: auth.guest.id },
        select: { expiresAt: true, windowStartedAt: true, windowRequests: true },
      });
      if (!current || current.expiresAt <= now) throw new GuestError('guest-session-expired', 401);
      const windowLimited =
        current.windowRequests >= GUEST_LIMITS.requestsPerMinute &&
        current.windowStartedAt.getTime() + 60_000 > now.getTime();
      const retryAt = windowLimited
        ? current.windowStartedAt.getTime() + 60_000
        : current.expiresAt.getTime();
      throw new GuestError(
        'guest-resource-limit',
        429,
        Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000)),
      );
    }
    return null;
  } catch (error) {
    if (!(error instanceof GuestError))
      console.error(
        JSON.stringify({
          event: 'guest.quota.failed',
          code: (error as { code?: string })?.code || 'dependency-unavailable',
        }),
      );
    return guestErrorResponse(error, safeRequestId(request.headers.get('x-request-id')));
  }
}
