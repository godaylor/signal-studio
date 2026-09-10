import type { Auth } from '@/lib/types';
import { resolveProjectAccess } from './capabilities';
import { projectDataScopeForCapabilities } from './project-data';

export interface InsightAccess {
  actorUserId: string;
  projectId: string;
  tenantId: string;
  permissionScope: string;
  canCreate: boolean;
  canManageAll: boolean;
  canEditDashboards?: boolean;
  canCreateSegments?: boolean;
  canCreatePublicShare?: boolean;
}

export function deriveInsightCapabilities({
  isAdmin,
  isProjectOwner,
  globalRole,
  teamRole,
}: {
  isAdmin: boolean;
  isProjectOwner: boolean;
  globalRole: string;
  teamRole?: string;
}) {
  // Kept for legacy callers and tests. M14 authorization uses resolveProjectAccess.
  const globalCanWrite = globalRole !== 'view-only';
  return {
    canCreate: isAdmin || (isProjectOwner && globalCanWrite) || teamRole === 'team-member' || teamRole === 'team-manager' || teamRole === 'team-owner',
    canManageAll: isAdmin || (isProjectOwner && globalCanWrite) || teamRole === 'team-manager' || teamRole === 'team-owner',
  };
}

export async function getInsightAccess(
  auth: Auth | null | undefined,
  projectId: string,
): Promise<InsightAccess | null> {
  const access = await resolveProjectAccess(auth, projectId);
  if (!access || !auth?.user || !access.capabilities.viewAggregate) return null;

  return {
    actorUserId: auth.user.id,
    projectId,
    tenantId: access.workspaceId,
    permissionScope: projectDataScopeForCapabilities(access.capabilities),
    canCreate: access.capabilities.editInsights,
    canManageAll:
      access.capabilities.manageWorkspaceSecurity || access.capabilities.manageMembers,
    canEditDashboards: access.capabilities.editDashboards,
    canCreateSegments: access.capabilities.createSegments,
    canCreatePublicShare: access.capabilities.createPublicShare,
  };
}

export function canMutateInsight(access: InsightAccess, ownerId: string) {
  return access.canManageAll || (access.canCreate && ownerId === access.actorUserId);
}
