import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { Auth } from '@/lib/types';
import {
  deriveStudioCapabilities,
  isStudioRole,
  legacyRoleToStudioRole,
  resolveProjectAccess,
  sanitizeCapabilityOverrides,
  studioRoleToLegacyRole,
  type CapabilityOverrides,
  type ProjectAccess,
  type StudioRole,
} from '@/server/permissions/capabilities';

const ROLE_RANK: Record<StudioRole, number> = {
  owner: 5,
  admin: 4,
  analyst: 3,
  editor: 2,
  viewer: 1,
};

const SECURITY_CAPABILITIES = [
  'manageWorkspaceSecurity',
  'viewSensitiveTraits',
  'viewReplay',
  'exportData',
  'createPublicShare',
] as const;

export class MembershipForbiddenError extends Error {}
export class MembershipNotFoundError extends Error {}
export class MembershipConflictError extends Error {}

type MemberRecord = {
  id: string;
  role: string;
  studioRole: string | null;
  capabilityOverrides: unknown;
  createdAt: Date | null;
  updatedAt: Date | null;
  user: { id: string; username: string; displayName: string | null };
};

function toMemberDto(record: MemberRecord) {
  const studioRole = isStudioRole(record.studioRole)
    ? record.studioRole
    : legacyRoleToStudioRole(record.role);
  const overrides = sanitizeCapabilityOverrides(record.capabilityOverrides);
  return {
    id: record.id,
    user: record.user,
    studioRole,
    legacyRole: record.role,
    capabilityOverrides: overrides,
    capabilities: deriveStudioCapabilities(studioRole, overrides),
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

async function getMemberAdminAccess(auth: Auth, projectId: string) {
  const access = await resolveProjectAccess(auth, projectId);
  if (!access?.capabilities.manageMembers)
    throw new MembershipForbiddenError('This role cannot manage workspace members.');

  const project = await prisma.client.website.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { teamId: true },
  });
  if (!project?.teamId)
    throw new MembershipConflictError('This source is not attached to a team workspace.');

  return { access, teamId: project.teamId };
}

function assertMayAssign(actor: ProjectAccess, targetRole: StudioRole) {
  if (targetRole === 'owner')
    throw new MembershipForbiddenError('Workspace ownership cannot be assigned here.');
  if (!actor.isSystemAdmin && ROLE_RANK[targetRole] >= ROLE_RANK[actor.studioRole])
    throw new MembershipForbiddenError('You cannot assign a role at or above your own role.');
}

function assertMayChangeSecurityOverrides(
  actor: ProjectAccess,
  previous: CapabilityOverrides,
  next: CapabilityOverrides,
) {
  const changed = SECURITY_CAPABILITIES.some(
    capability => previous[capability] !== next[capability],
  );
  if (changed && !actor.capabilities.manageWorkspaceSecurity)
    throw new MembershipForbiddenError('Workspace security permission is required.');
}

export async function listWorkspaceMembers(auth: Auth, projectId: string, limit: number) {
  const { access, teamId } = await getMemberAdminAccess(auth, projectId);
  const records = await prisma.client.teamUser.findMany({
    where: { teamId },
    select: {
      id: true,
      role: true,
      studioRole: true,
      capabilityOverrides: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  return {
    data: records.map(toMemberDto),
    actor: {
      studioRole: access.studioRole,
      capabilities: access.capabilities,
      isSystemAdmin: access.isSystemAdmin,
    },
    limit,
  };
}

export async function createWorkspaceMember({
  auth,
  projectId,
  username,
  studioRole,
  capabilityOverrides,
}: {
  auth: Auth;
  projectId: string;
  username: string;
  studioRole: Exclude<StudioRole, 'owner'>;
  capabilityOverrides: CapabilityOverrides;
}) {
  const { access, teamId } = await getMemberAdminAccess(auth, projectId);
  assertMayAssign(access, studioRole);
  assertMayChangeSecurityOverrides(access, {}, capabilityOverrides);

  const user = await prisma.client.user.findFirst({
    where: { username, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new MembershipNotFoundError('User was not found.');
  const existing = await prisma.client.teamUser.findFirst({ where: { teamId, userId: user.id } });
  if (existing) throw new MembershipConflictError('User is already a workspace member.');

  const record = await prisma.client.teamUser.create({
    data: {
      id: randomUUID(),
      teamId,
      userId: user.id,
      role: studioRoleToLegacyRole(studioRole),
      studioRole,
      capabilityOverrides: capabilityOverrides as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      role: true,
      studioRole: true,
      capabilityOverrides: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
  });
  return toMemberDto(record);
}

export async function updateWorkspaceMember({
  auth,
  projectId,
  memberId,
  studioRole,
  capabilityOverrides,
}: {
  auth: Auth;
  projectId: string;
  memberId: string;
  studioRole?: Exclude<StudioRole, 'owner'>;
  capabilityOverrides?: CapabilityOverrides;
}) {
  const { access, teamId } = await getMemberAdminAccess(auth, projectId);
  const current = await prisma.client.teamUser.findFirst({
    where: { id: memberId, teamId },
    select: {
      id: true,
      role: true,
      studioRole: true,
      capabilityOverrides: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
  });
  if (!current) throw new MembershipNotFoundError('Workspace member was not found.');
  const currentRole = isStudioRole(current.studioRole)
    ? current.studioRole
    : legacyRoleToStudioRole(current.role);
  if (currentRole === 'owner' && !access.isSystemAdmin)
    throw new MembershipForbiddenError('Workspace owner membership is protected.');
  if (!access.isSystemAdmin && ROLE_RANK[currentRole] >= ROLE_RANK[access.studioRole])
    throw new MembershipForbiddenError('You cannot change a peer or higher role.');
  if (studioRole) assertMayAssign(access, studioRole);

  const previousOverrides = sanitizeCapabilityOverrides(current.capabilityOverrides);
  const nextOverrides = capabilityOverrides ?? previousOverrides;
  assertMayChangeSecurityOverrides(access, previousOverrides, nextOverrides);
  const nextRole = studioRole ?? currentRole;
  const record = await prisma.client.teamUser.update({
    where: { id: memberId },
    data: {
      role: studioRoleToLegacyRole(nextRole),
      studioRole: nextRole,
      ...(capabilityOverrides !== undefined
        ? { capabilityOverrides: capabilityOverrides as Prisma.InputJsonValue }
        : {}),
    },
    select: {
      id: true,
      role: true,
      studioRole: true,
      capabilityOverrides: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
  });
  return toMemberDto(record);
}

export async function deleteWorkspaceMember(auth: Auth, projectId: string, memberId: string) {
  const { access, teamId } = await getMemberAdminAccess(auth, projectId);
  const current = await prisma.client.teamUser.findFirst({
    where: { id: memberId, teamId },
    select: { id: true, role: true, studioRole: true },
  });
  if (!current) throw new MembershipNotFoundError('Workspace member was not found.');
  const currentRole = isStudioRole(current.studioRole)
    ? current.studioRole
    : legacyRoleToStudioRole(current.role);
  if (currentRole === 'owner' && !access.isSystemAdmin)
    throw new MembershipForbiddenError('Workspace owner membership is protected.');
  if (!access.isSystemAdmin && ROLE_RANK[currentRole] >= ROLE_RANK[access.studioRole])
    throw new MembershipForbiddenError('You cannot remove a peer or higher role.');
  await prisma.client.teamUser.delete({ where: { id: memberId } });
}
