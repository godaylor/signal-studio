import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { checkAuth } from '@/lib/auth';
import { parseRequest } from '@/lib/request';
import { POST as logout } from '@/app/api/auth/logout/route';
import { hashPassword } from '@/lib/password';
import { issueAuthToken } from '@/server/auth/tokens';
import prisma from '@/lib/prisma';
import { analysisQueryService } from '@/server/analytics/query-service';
import {
  createDashboard,
  addDashboardWidget,
  getDashboard,
} from '@/server/dashboards/dashboard-service';
import { createExport } from '@/server/exports/service';
import { GUEST_DATASET } from '@/server/guest/dataset';
import { enforceGuestRequest } from '@/server/guest/guard';
import { startGuestSession, cleanupExpiredGuests } from '@/server/guest/service';
import { guestCookie, guestTokenHash, resolveGuestSession } from '@/server/guest/session';
import { createInsight, getInsight } from '@/server/insights/insight-service';
import { getAnalysisAccess } from '@/server/permissions/analysis';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { getInsightAccess } from '@/server/permissions/insights';
import { disconnectLifecycleLocks, withLifecycleIngestion } from '@/server/lifecycle/ingestion';

let first: Awaited<ReturnType<typeof startGuestSession>>;
let second: Awaited<ReturnType<typeof startGuestSession>>;
const runAt = new Date();
// This isolated process simulates a distinct trusted-proxy client, so its
// fixtures do not consume the later browser suite's real direct-client budget.
const integrationClientIp = `2001:db8:${randomUUID()
  .replaceAll('-', '')
  .slice(0, 24)
  .replace(/(.{4})(?=.)/g, '$1:')}`;
const baseRequest = new Request('https://guest.test/api/guest', {
  method: 'POST',
  headers: { 'x-guest-integration-client': integrationClientIp },
});
const guestRequest = (session: typeof first, path: string, method = 'GET', body?: unknown) =>
  new Request(`https://guest.test${path}`, {
    method,
    headers: {
      cookie: guestCookie(session.token, baseRequest),
      'content-type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const queryInput = (session: typeof first) => session.guest.defaultQuery;

describe('server-persistent isolated guest workspaces', () => {
  beforeAll(async () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-guest-integration-client');
    first = await startGuestSession(baseRequest, runAt);
    second = await startGuestSession(baseRequest, runAt);
  });
  afterAll(async () => {
    try {
      for (const session of [first, second].filter(Boolean)) {
        await prisma.client.guestSession.updateMany({
          where: { id: session.guest.id },
          data: { expiresAt: new Date() },
        });
      }
      await cleanupExpiredGuests(new Date(), 50);
    } finally {
      vi.unstubAllEnvs();
      await disconnectLifecycleLocks();
      await prisma.client.$disconnect();
    }
  });

  test('stores only the digest, resumes the same server workspace, uses real private principals', async () => {
    const record = await prisma.client.guestSession.findUniqueOrThrow({
      where: { id: first.guest.id },
    });
    expect(record.tokenHash).toBe(guestTokenHash(first.token));
    expect(record.tokenHash).not.toBe(first.token);
    const resumed = await startGuestSession(guestRequest(first, '/api/guest'), runAt);
    expect(resumed.guest.projectId).toBe(first.guest.projectId);
    expect(resumed.token).toBeNull();
    expect(second.guest.projectId).not.toBe(first.guest.projectId);
    const auth = await checkAuth(guestRequest(first, '/api/auth/verify', 'POST'));
    const access = await resolveProjectAccess(auth, first.guest.projectId);
    expect(access?.capabilities).toMatchObject({
      editInsights: true,
      editDashboards: true,
      createSegments: true,
      exportData: true,
      manageMembers: false,
      manageSources: false,
      manageWorkspaceSecurity: false,
      createPublicShare: false,
      viewReplay: false,
    });
    expect(await getAnalysisAccess(auth, second.guest.projectId)).toBeNull();
  });

  test('real stored events reproduce golden counts, device funnels and parameter changes', async () => {
    const projectId = first.guest.projectId;
    const [events, users, sessions] = await Promise.all([
      prisma.client.websiteEvent.count({ where: { websiteId: projectId } }),
      prisma.client.trackedUser.count({ where: { projectId } }),
      prisma.client.session.count({ where: { websiteId: projectId } }),
    ]);
    expect({ events, users, sessions }).toEqual({
      events: GUEST_DATASET.events,
      users: GUEST_DATASET.users,
      sessions: GUEST_DATASET.sessions,
    });
    const execute = (query: unknown) =>
      analysisQueryService.execute({
        query,
        projectId,
        tenantId: first.guest.workspaceId,
        permissionScope: 'identity-standard',
      });
    const result = await execute(queryInput(first));
    const steps = result.data.rows.filter(row => 'kind' in row && row.kind === 'funnel-step');
    expect(steps.map(row => row.value)).toEqual([336, 252, 168]);
    const buckets = result.data.rows
      .filter(row => 'kind' in row && row.kind === 'funnel-trend')
      .map(row => ('bucket' in row ? row.bucket : ''));
    expect(buckets).toEqual([...buckets].sort());
    for (const [device, expected] of [
      ['desktop', [168, 126, 126]],
      ['mobile', [168, 126, 42]],
    ] as const) {
      const filtered = await execute({
        ...queryInput(first),
        filters: [{ field: 'device', operator: 'equals', value: device }],
      });
      expect(
        filtered.data.rows
          .filter(row => 'kind' in row && row.kind === 'funnel-step')
          .map(row => row.value),
      ).toEqual(expected);
    }
    const trend = await execute({
      ...queryInput(first),
      mode: 'trend',
      funnel: undefined,
      visualization: 'line',
      measure: { source: 'event', key: 'core_feature_used', aggregation: 'count' },
    });
    expect(trend.data.rows.reduce((sum, row) => sum + Number(row.value), 0)).toBe(273);
    const retention = await execute({
      ...queryInput(first),
      mode: 'trend',
      funnel: undefined,
      visualization: 'line',
      measure: { source: 'lifecycle', key: 'retained', aggregation: 'count' },
    });
    expect(retention.data.total).toEqual({ value: 105, denominator: 168, rate: 105 / 168 });
    const eligibleReturn = await prisma.client.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT count(DISTINCT u.tracked_user_id)
      FROM tracked_user u JOIN session s ON s.distinct_id=u.external_id AND s.website_id=u.project_id
      JOIN website_event e ON e.session_id=s.session_id AND e.website_id=s.website_id
      WHERE u.project_id=${projectId}::uuid AND e.event_name='core_feature_used' AND e.created_at>=u.activated_at+INTERVAL '7 days'`;
    expect(Number(eligibleReturn[0].count)).toBe(105);
    const narrow = await execute({
      ...queryInput(first),
      range: {
        ...queryInput(first).range,
        endAt: new Date(new Date(first.guest.dataset.startAt).getTime() + 86_400_000).toISOString(),
      },
    });
    expect(
      narrow.data.rows
        .filter(row => 'kind' in row && row.kind === 'funnel-step')
        .map(row => row.value),
    ).toEqual([8, 6, 4]);
  });

  test('saves and reopens Insight, dashboard and export using the existing application services', async () => {
    const auth = await checkAuth(guestRequest(first, '/api/auth/verify', 'POST'));
    const access = await getInsightAccess(auth, first.guest.projectId);
    const insight = await createInsight({
      access,
      title: 'Guest saved analysis',
      query: queryInput(first),
    });
    const dashboard = await createDashboard({ access, title: 'Guest assembled dashboard' });
    await addDashboardWidget({
      access,
      dashboardId: dashboard.id,
      kind: 'insight',
      insightId: insight.id,
    });
    const reloadedAuth = await checkAuth(guestRequest(first, '/api/auth/verify', 'POST'));
    const reloadedAccess = await getInsightAccess(reloadedAuth, first.guest.projectId);
    expect((await getInsight(reloadedAccess, insight.id)).title).toBe('Guest saved analysis');
    expect((await getDashboard(reloadedAccess, dashboard.id)).widgets[0].insightId).toBe(
      insight.id,
    );
    const exported = await createExport(
      reloadedAuth,
      first.guest.projectId,
      {
        version: 1,
        source: { kind: 'analysis', query: queryInput(first) },
        format: 'json',
        allRows: false,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );
    expect(exported.kind).toBe('download');
    if (exported.kind === 'download') expect(exported.data.toString()).toContain('336');
    await expect(
      createExport(
        reloadedAuth,
        first.guest.projectId,
        {
          version: 1,
          source: { kind: 'analysis', query: queryInput(first) },
          format: 'csv',
          allRows: true,
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toThrow('guest-export-analysis-only');
    const otherAuth = await checkAuth(guestRequest(second, '/api/auth/verify', 'POST'));
    expect(await getInsightAccess(otherAuth, first.guest.projectId)).toBeNull();
    await expect(
      createExport(
        otherAuth,
        first.guest.projectId,
        {
          version: 1,
          source: { kind: 'analysis', query: queryInput(first) },
          format: 'json',
          allRows: false,
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toThrow('export-access-denied');
  });

  test('atomically bounds concurrent operations and request bodies and rejects prohibited operations', async () => {
    const auth = await checkAuth(guestRequest(first, '/api/auth/verify', 'POST'));
    await prisma.client.guestSession.update({
      where: { id: first.guest.id },
      data: { operations: { insights: 29 } },
    });
    const responses = await Promise.all(
      Array.from({ length: 3 }, () =>
        enforceGuestRequest(
          guestRequest(first, `/api/projects/${first.guest.projectId}/insights`, 'POST'),
          auth,
        ),
      ),
    );
    expect(responses.filter(response => response === null)).toHaveLength(1);
    expect(responses.filter(response => response?.status === 429)).toHaveLength(2);
    const denied = await parseRequest(guestRequest(first, '/api/teams', 'POST'));
    expect(denied.error().status).toBe(403);
    const oversized = await parseRequest(
      guestRequest(first, `/api/projects/${first.guest.projectId}/insights`, 'POST', {
        title: 'x'.repeat(70_000),
      }),
    );
    expect(oversized.error().status).toBe(413);
  });

  test('normal accounts retain their own auth, permissions and request behavior while a guest cookie coexists', async () => {
    const userId = randomUUID();
    const projectId = randomUUID();
    const user = await prisma.client.user.create({
      data: {
        id: userId,
        username: `guest-regression-${userId}`,
        password: hashPassword(randomUUID()),
        role: 'user',
      },
    });
    try {
      await prisma.client.website.create({
        data: { id: projectId, name: 'Preserved account project', userId },
      });
      const token = issueAuthToken(user, 1);
      const request = new Request(`https://guest.test/api/projects/${projectId}/insights`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          cookie: guestCookie(first.token, baseRequest),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ value: 'x'.repeat(70_000) }),
      });
      const parsed = await parseRequest(request);
      expect(parsed.error).toBeUndefined();
      expect(parsed.auth.user.id).toBe(userId);
      expect(parsed.auth.guest).toBeUndefined();
      expect(parsed.body.value).toHaveLength(70_000);
      const access = await resolveProjectAccess(parsed.auth, projectId);
      expect(access?.capabilities).toMatchObject({
        manageMembers: true,
        manageSources: true,
        createPublicShare: true,
        exportData: true,
      });
      expect(await getAnalysisAccess(parsed.auth, first.guest.projectId)).toBeNull();
      expect(
        (await prisma.client.user.findUniqueOrThrow({ where: { id: userId } })).sessionVersion,
      ).toBe(0);
    } finally {
      await prisma.client.website.deleteMany({ where: { id: projectId } });
      await prisma.client.user.deleteMany({ where: { id: userId } });
    }
  });

  test('expiry denies auth and cleanup physically removes only the expired guest tenant', async () => {
    let wrote = false;
    const attemptIngestion = () =>
      withLifecycleIngestion(first.guest.projectId, async () => {
        wrote = true;
        return Response.json({ ok: true });
      });
    expect((await attemptIngestion()).status).toBe(403);
    expect(wrote).toBe(false);
    await prisma.client.guestSession.update({
      where: { id: first.guest.id },
      data: { lifetimeRequests: 5000, windowRequests: 120 },
    });
    const revoked = await logout(guestRequest(first, '/api/auth/logout', 'POST'));
    expect(revoked.status).toBe(200);
    expect(revoked.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(
      await resolveGuestSession(
        guestRequest(first, '/api/auth/verify'),
        new Date(Date.now() + 1_000),
      ),
    ).toBeNull();
    expect(await checkAuth(guestRequest(first, '/api/auth/verify', 'POST'))).toBeNull();
    await cleanupExpiredGuests(new Date(Date.now() + 1_000), 50);
    expect(
      await prisma.client.websiteEvent.count({ where: { websiteId: first.guest.projectId } }),
    ).toBe(0);
    expect(await prisma.client.website.count({ where: { id: first.guest.projectId } })).toBe(0);
    expect(await prisma.client.user.count({ where: { id: first.user.id } })).toBe(0);
    expect((await attemptIngestion()).status).toBe(403);
    expect(wrote).toBe(false);
    expect(
      await prisma.client.websiteEvent.count({ where: { websiteId: second.guest.projectId } }),
    ).toBe(1281);
    expect(await resolveGuestSession(guestRequest(second, '/api/auth/verify'))).not.toBeNull();
  });
});
