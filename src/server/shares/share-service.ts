import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import type { z } from 'zod';
import { checkAuth } from '@/lib/auth';
import { secret } from '@/lib/crypto';
import { ENTITY_TYPE, SHARE_TOKEN_HEADER, SHARE_TOKEN_TYPE } from '@/lib/constants';
import { createToken, parseToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import type { Auth } from '@/lib/types';
import { analysisQueryService } from '@/server/analytics/query-service';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import {
  type SAFE_SHARE_SCOPE,
  safeShareScopeSchema,
  type shareResourceTypeSchema,
  type shareVisibilitySchema,
} from './contracts';

export const STUDIO_SHARE_AUDIENCE = 'signal-studio-share';
export const STUDIO_SHARE_ISSUER = 'signal-studio';
const MAX_SHARE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_SECONDS = 5 * 60;

type ShareResourceType = z.infer<typeof shareResourceTypeSchema>;
type ShareVisibility = z.infer<typeof shareVisibilitySchema>;

export class StudioShareForbiddenError extends Error {}
export class StudioShareNotFoundError extends Error {}
export class StudioShareValidationError extends Error {}

function parseExpiry(value: string, now = Date.now()) {
  const expiresAt = new Date(value);
  const lifetime = expiresAt.getTime() - now;
  if (!Number.isFinite(lifetime) || lifetime <= 0 || lifetime > MAX_SHARE_LIFETIME_MS)
    throw new StudioShareValidationError('Share expiry must be in the future and within 90 days.');
  return expiresAt;
}

function toShareDto(share: any) {
  return {
    id: share.id,
    projectId: share.projectId,
    resourceId: share.entityId,
    resourceType: share.resourceType,
    name: share.name,
    visibility: share.visibility,
    slug: share.slug,
    scope: safeShareScopeSchema.parse(share.scope),
    expiresAt: share.expiresAt?.toISOString() ?? null,
    revokedAt: share.revokedAt?.toISOString() ?? null,
    createdAt: share.createdAt?.toISOString() ?? null,
    updatedAt: share.updatedAt?.toISOString() ?? null,
  };
}

async function requireShareResource(projectId: string, resourceType: ShareResourceType, resourceId: string) {
  const exists =
    resourceType === 'insight'
      ? await prisma.client.insight.findFirst({
          where: { id: resourceId, projectId, status: 'active' },
          select: { id: true },
        })
      : await prisma.client.studioDashboard.findFirst({
          where: { id: resourceId, projectId },
          select: { id: true },
        });
  if (!exists) throw new StudioShareNotFoundError('Share resource was not found.');
}

async function requireShareAdmin(auth: Auth, projectId: string, visibility?: ShareVisibility) {
  const access = await resolveProjectAccess(auth, projectId);
  if (!access) throw new StudioShareForbiddenError('Project access is required.');
  if (visibility === 'public' && !access.capabilities.createPublicShare)
    throw new StudioShareForbiddenError('Public sharing capability is required.');
  if (!access.capabilities.editInsights && !access.capabilities.editDashboards)
    throw new StudioShareForbiddenError('Edit access is required to create a share.');
  return access;
}

export async function listStudioShares(auth: Auth, projectId: string) {
  await requireShareAdmin(auth, projectId);
  const records = await prisma.client.share.findMany({
    where: { projectId, resourceType: { in: ['insight', 'dashboard'] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
  });
  return { data: records.map(toShareDto), limit: 100 };
}

export async function createStudioShare({
  auth,
  projectId,
  resourceType,
  resourceId,
  name,
  visibility,
  expiresAt,
  scope,
}: {
  auth: Auth;
  projectId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  name: string;
  visibility: ShareVisibility;
  expiresAt: string;
  scope: typeof SAFE_SHARE_SCOPE;
}) {
  const access = await requireShareAdmin(auth, projectId, visibility);
  if (
    (resourceType === 'insight' && !access.capabilities.editInsights) ||
    (resourceType === 'dashboard' && !access.capabilities.editDashboards)
  )
    throw new StudioShareForbiddenError('This role cannot share that resource type.');
  await requireShareResource(projectId, resourceType, resourceId);
  const validatedScope = safeShareScopeSchema.parse(scope);
  const record = await prisma.client.share.create({
    data: {
      id: randomUUID(),
      entityId: resourceId,
      projectId,
      createdBy: access.actorUserId,
      name,
      shareType: resourceType === 'insight' ? ENTITY_TYPE.insight : ENTITY_TYPE.dashboard,
      resourceType,
      visibility,
      slug: randomUUID().replaceAll('-', ''),
      parameters: { version: 1 } as Prisma.InputJsonValue,
      scope: validatedScope as Prisma.InputJsonValue,
      tokenVersion: 1,
      expiresAt: parseExpiry(expiresAt),
    },
  });
  return toShareDto(record);
}

async function requireMutableShare(auth: Auth, projectId: string, shareId: string) {
  const access = await requireShareAdmin(auth, projectId);
  const share = await prisma.client.share.findFirst({
    where: { id: shareId, projectId, resourceType: { in: ['insight', 'dashboard'] } },
  });
  if (!share) throw new StudioShareNotFoundError('Share was not found.');
  if (
    share.createdBy !== access.actorUserId &&
    !access.capabilities.manageMembers &&
    !access.capabilities.manageWorkspaceSecurity
  )
    throw new StudioShareForbiddenError('Only the share creator or a workspace administrator can change it.');
  return { access, share };
}

export async function updateStudioShare({
  auth,
  projectId,
  shareId,
  name,
  expiresAt,
  scope,
}: {
  auth: Auth;
  projectId: string;
  shareId: string;
  name?: string;
  expiresAt?: string;
  scope?: typeof SAFE_SHARE_SCOPE;
}) {
  await requireMutableShare(auth, projectId, shareId);
  const invalidatesToken = expiresAt !== undefined || scope !== undefined;
  const record = await prisma.client.share.update({
    where: { id: shareId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(expiresAt !== undefined ? { expiresAt: parseExpiry(expiresAt) } : {}),
      ...(scope !== undefined
        ? { scope: safeShareScopeSchema.parse(scope) as Prisma.InputJsonValue }
        : {}),
      ...(invalidatesToken ? { tokenVersion: { increment: 1 } } : {}),
    },
  });
  return toShareDto(record);
}

export async function revokeStudioShare(auth: Auth, projectId: string, shareId: string) {
  const { share } = await requireMutableShare(auth, projectId, shareId);
  if (share.revokedAt) return toShareDto(share);
  const record = await prisma.client.share.update({
    where: { id: shareId },
    data: { revokedAt: new Date(), tokenVersion: { increment: 1 } },
  });
  return toShareDto(record);
}

async function loadSafeResource(share: any, signal?: AbortSignal) {
  if (share.resourceType === 'insight') {
    const insight = await prisma.client.insight.findFirst({
      where: { id: share.entityId, projectId: share.projectId, status: 'active' },
      select: { id: true, title: true, description: true, query: true, visualization: true, updatedAt: true },
    });
    if (!insight) throw new StudioShareNotFoundError('Shared Insight was not found.');
    const result = await analysisQueryService.execute({
      query: insight.query,
      projectId: share.projectId,
      tenantId: share.projectId,
      permissionScope: 'public-share:aggregate:v1',
      signal,
    });
    return {
      type: 'insight' as const,
      title: insight.title,
      description: insight.description,
      visualization: insight.visualization,
      updatedAt: insight.updatedAt.toISOString(),
      result,
    };
  }

  const dashboard = await prisma.client.studioDashboard.findFirst({
    where: { id: share.entityId, projectId: share.projectId },
    select: {
      id: true,
      title: true,
      description: true,
      updatedAt: true,
      widgets: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        take: 24,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          position: true,
          width: true,
          height: true,
          insight: {
            select: { id: true, title: true, description: true, query: true, visualization: true },
          },
        },
      },
    },
  });
  if (!dashboard) throw new StudioShareNotFoundError('Shared Dashboard was not found.');
  const uniqueInsights = new Map(
    dashboard.widgets.flatMap(widget =>
      widget.insight ? [[widget.insight.id, widget.insight] as const] : [],
    ),
  );
  const resultByInsight = new Map<string, unknown>();
  await Promise.all(
    [...uniqueInsights.values()].map(async insight => {
      const result = await analysisQueryService.execute({
        query: insight.query,
        projectId: share.projectId,
        tenantId: share.projectId,
        permissionScope: 'public-share:aggregate:v1',
        signal,
      });
      resultByInsight.set(insight.id, result);
    }),
  );
  return {
    type: 'dashboard' as const,
    title: dashboard.title,
    description: dashboard.description,
    updatedAt: dashboard.updatedAt.toISOString(),
    widgets: dashboard.widgets.map(widget => ({
      ...widget,
      insight: widget.insight
        ? { ...widget.insight, query: undefined, result: resultByInsight.get(widget.insight.id) }
        : null,
    })),
  };
}

function assertActiveShare(share: any, now = Date.now()) {
  if (
    !share?.projectId ||
    !share.resourceType ||
    share.revokedAt ||
    !share.expiresAt ||
    share.expiresAt.getTime() <= now
  )
    throw new StudioShareNotFoundError('Share is unavailable, expired or revoked.');
}

export async function resolveStudioShare(share: any, request: Request) {
  assertActiveShare(share);
  if (share.visibility === 'internal') {
    const auth = await checkAuth(request);
    if (!auth?.user || auth.assuranceRequired)
      throw new StudioShareNotFoundError('Share is unavailable.');
    const access = await resolveProjectAccess(auth, share.projectId);
    if (!access?.capabilities.viewAggregate)
      throw new StudioShareNotFoundError('Share is unavailable.');
  }
  const secondsRemaining = Math.max(
    1,
    Math.floor((share.expiresAt.getTime() - Date.now()) / 1000),
  );
  const token = createToken(
    {
      type: SHARE_TOKEN_TYPE,
      shareId: share.id,
      tokenVersion: share.tokenVersion,
      resourceType: share.resourceType,
      visibility: share.visibility,
    },
    secret(),
    {
      audience: STUDIO_SHARE_AUDIENCE,
      issuer: STUDIO_SHARE_ISSUER,
      expiresIn: Math.min(TOKEN_TTL_SECONDS, secondsRemaining),
    },
  );
  return {
    shareId: share.id,
    shareType: share.shareType,
    resourceType: share.resourceType,
    projectId: share.projectId,
    parameters: share.parameters,
    scope: safeShareScopeSchema.parse(share.scope),
    expiresAt: share.expiresAt.toISOString(),
    token,
    resource: await loadSafeResource(share, request.signal),
  };
}

export async function resolveStudioShareToken(slug: string, request: Request) {
  const token = request.headers.get(SHARE_TOKEN_HEADER);
  const parsed = token
    ? (parseToken(token, secret(), {
        audience: STUDIO_SHARE_AUDIENCE,
        issuer: STUDIO_SHARE_ISSUER,
      }) as any)
    : null;
  if (!parsed || parsed.type !== SHARE_TOKEN_TYPE || !parsed.shareId)
    throw new StudioShareNotFoundError('Share token is invalid.');
  const share = await prisma.client.share.findFirst({ where: { slug, id: parsed.shareId } });
  assertActiveShare(share);
  if (share.tokenVersion !== parsed.tokenVersion)
    throw new StudioShareNotFoundError('Share token has been revoked.');
  if (share.visibility === 'internal') {
    const auth = await checkAuth(request);
    if (!auth?.user || auth.assuranceRequired)
      throw new StudioShareNotFoundError('Share is unavailable.');
    const access = await resolveProjectAccess(auth, share.projectId);
    if (!access?.capabilities.viewAggregate)
      throw new StudioShareNotFoundError('Share is unavailable.');
  }
  return { data: await loadSafeResource(share, request.signal) };
}
