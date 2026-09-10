import type { Auth } from '@/lib/types';
import {
  resolveProjectAccess,
  type StudioCapabilities,
} from '@/server/permissions/capabilities';

export const PROJECT_DATA_SCOPES = Object.freeze({
  deny: 'deny',
  aggregate: 'aggregate-only',
  standard: 'identity-standard',
  sensitive: 'identity-sensitive',
});

export type ProjectDataScope = (typeof PROJECT_DATA_SCOPES)[keyof typeof PROJECT_DATA_SCOPES];

export function projectDataScopeForCapabilities(
  capabilities: StudioCapabilities,
): ProjectDataScope {
  if (!capabilities.viewAggregate) return PROJECT_DATA_SCOPES.deny;
  if (capabilities.viewSensitiveTraits) return PROJECT_DATA_SCOPES.sensitive;
  if (capabilities.viewIdentity) return PROJECT_DATA_SCOPES.standard;
  return PROJECT_DATA_SCOPES.aggregate;
}

export async function getProjectDataScope(
  auth: Auth | null | undefined,
  projectId: string,
): Promise<ProjectDataScope> {
  const access = await resolveProjectAccess(auth, projectId);
  return access
    ? projectDataScopeForCapabilities(access.capabilities)
    : PROJECT_DATA_SCOPES.deny;
}

export function canViewSensitiveTraits(scope: ProjectDataScope) {
  return scope === PROJECT_DATA_SCOPES.sensitive;
}

export function getProjectPermissionScope(scope: ProjectDataScope) {
  return scope;
}
