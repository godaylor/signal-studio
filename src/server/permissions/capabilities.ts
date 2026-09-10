import { ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import type { Auth } from '@/lib/types';

export const STUDIO_ROLES = ['owner', 'admin', 'analyst', 'editor', 'viewer'] as const;
export type StudioRole = (typeof STUDIO_ROLES)[number];

export const STUDIO_CAPABILITIES = [
  'manageWorkspaceSecurity',
  'manageMembers',
  'manageSources',
  'editInsights',
  'editDashboards',
  'createSegments',
  'viewAggregate',
  'viewIdentity',
  'viewSensitiveTraits',
  'viewReplay',
  'exportData',
  'createPublicShare',
] as const;

export type StudioCapability = (typeof STUDIO_CAPABILITIES)[number];
export type StudioCapabilities = Record<StudioCapability, boolean>;
export type CapabilityOverrides = Partial<StudioCapabilities>;

const denyAll = (): StudioCapabilities =>
  Object.fromEntries(STUDIO_CAPABILITIES.map(capability => [capability, false])) as StudioCapabilities;

export const ROLE_CAPABILITIES: Readonly<Record<StudioRole, StudioCapabilities>> = Object.freeze({
  owner: Object.fromEntries(STUDIO_CAPABILITIES.map(capability => [capability, true])) as StudioCapabilities,
  admin: {
    ...denyAll(),
    manageMembers: true,
    manageSources: true,
    editInsights: true,
    editDashboards: true,
    createSegments: true,
    viewAggregate: true,
    viewIdentity: true,
  },
  analyst: {
    ...denyAll(),
    editInsights: true,
    editDashboards: true,
    createSegments: true,
    viewAggregate: true,
    viewIdentity: true,
  },
  editor: {
    ...denyAll(),
    editInsights: true,
    editDashboards: true,
    createSegments: true,
    viewAggregate: true,
  },
  viewer: {
    ...denyAll(),
    viewAggregate: true,
  },
});

export function isStudioRole(value: unknown): value is StudioRole {
  return typeof value === 'string' && STUDIO_ROLES.includes(value as StudioRole);
}

export function sanitizeCapabilityOverrides(value: unknown): CapabilityOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    STUDIO_CAPABILITIES.flatMap(capability => {
      const override = (value as Record<string, unknown>)[capability];
      return typeof override === 'boolean' ? [[capability, override]] : [];
    }),
  ) as CapabilityOverrides;
}

export function deriveStudioCapabilities(
  role: StudioRole,
  overrides?: unknown,
): StudioCapabilities {
  return {
    ...ROLE_CAPABILITIES[role],
    ...sanitizeCapabilityOverrides(overrides),
  };
}

export function legacyRoleToStudioRole(role?: string | null): StudioRole {
  if (role === ROLES.teamViewOnly || role === ROLES.viewOnly) return 'viewer';
  switch (role) {
    case ROLES.teamOwner:
      return 'owner';
    case ROLES.teamManager:
      return 'admin';
    case ROLES.teamMember:
      return 'editor';
    default:
      return 'viewer';
  }
}

export function studioRoleToLegacyRole(role: StudioRole): string {
  switch (role) {
    case 'owner':
      return ROLES.teamOwner;
    case 'admin':
      return ROLES.teamManager;
    case 'analyst':
    case 'editor':
      return ROLES.teamMember;
    case 'viewer':
      return ROLES.teamViewOnly;
  }
}

export interface ProjectAccess {
  actorUserId: string;
  projectId: string;
  workspaceId: string;
  membershipId: string | null;
  legacyRole: string;
  studioRole: StudioRole;
  capabilities: StudioCapabilities;
  isSystemAdmin: boolean;
  isDirectOwner: boolean;
}

export async function resolveProjectAccess(
  auth: Auth | null | undefined,
  projectId: string,
): Promise<ProjectAccess | null> {
  if (!auth?.user) return null;

  const project = await prisma.client.website.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      teamId: true,
      team: {
        select: {
          members: {
            where: { userId: auth.user.id },
            select: {
              id: true,
              role: true,
              studioRole: true,
              capabilityOverrides: true,
            },
            take: 1,
          },
        },
      },
    },
  });
  if (!project) return null;

  const workspaceId = project.teamId ?? project.id;

  if (auth.user.isAdmin) {
    return {
      actorUserId: auth.user.id,
      projectId,
      workspaceId,
      membershipId: null,
      legacyRole: ROLES.admin,
      studioRole: 'admin',
      capabilities: deriveStudioCapabilities('owner'),
      isSystemAdmin: true,
      isDirectOwner: false,
    };
  }

  if (project.userId === auth.user.id) {
    const isReadOnly = auth.user.role === ROLES.viewOnly;
    const studioRole: StudioRole = isReadOnly ? 'viewer' : 'owner';
    return {
      actorUserId: auth.user.id,
      projectId,
      workspaceId,
      membershipId: null,
      legacyRole: auth.user.role,
      studioRole,
      capabilities: deriveStudioCapabilities(studioRole),
      isSystemAdmin: false,
      isDirectOwner: true,
    };
  }

  const membership = project.team?.members[0];
  if (!membership) return null;

  const studioRole = isStudioRole(membership.studioRole)
    ? membership.studioRole
    : legacyRoleToStudioRole(membership.role);

  return {
    actorUserId: auth.user.id,
    projectId,
    workspaceId,
    membershipId: membership.id,
    legacyRole: membership.role,
    studioRole,
    capabilities: deriveStudioCapabilities(studioRole, membership.capabilityOverrides),
    isSystemAdmin: false,
    isDirectOwner: false,
  };
}

export function hasStudioCapability(
  access: ProjectAccess | null | undefined,
  capability: StudioCapability,
) {
  return Boolean(access?.capabilities[capability]);
}
