import prisma from '@/lib/prisma';
import type { Auth } from '@/lib/types';
import {
  getProjectPermissionScope,
  PROJECT_DATA_SCOPES,
  type ProjectDataScope,
} from '@/server/permissions/project-data';

export interface ProjectFacade {
  id: string;
  name: string;
  workspaceId: string | null;
  permissionScope: ProjectDataScope;
  source: {
    id: string;
    type: 'website';
    domain: string | null;
  };
}

type ProjectRecord = {
  id: string;
  name: string;
  domain: string | null;
  userId: string | null;
  teamId: string | null;
  team?: { members: Array<{ role: string }> } | null;
};

function toProjectFacade(
  project: ProjectRecord,
  auth: Auth,
  forcedScope?: ProjectDataScope,
): ProjectFacade {
  const teamRole = project.team?.members[0]?.role;
  const scope =
    forcedScope ??
    (auth.user?.isAdmin || project.userId === auth.user?.id
      ? PROJECT_DATA_SCOPES.sensitive
      : teamRole === 'team-owner' || teamRole === 'team-manager'
        ? PROJECT_DATA_SCOPES.sensitive
        : PROJECT_DATA_SCOPES.standard);

  return {
    id: project.id,
    name: project.name,
    workspaceId: project.teamId,
    permissionScope: getProjectPermissionScope(scope),
    source: {
      id: project.id,
      type: 'website',
      domain: project.domain,
    },
  };
}

export async function listProjects(auth: Auth): Promise<ProjectFacade[]> {
  if (!auth.user) {
    return [];
  }

  const projects = await prisma.client.website.findMany({
    where: {
      deletedAt: null,
      ...(!auth.user.isAdmin && {
        OR: [
          { userId: auth.user.id },
          { team: { members: { some: { userId: auth.user.id } } } },
        ],
      }),
    },
    select: {
      id: true,
      name: true,
      domain: true,
      userId: true,
      teamId: true,
      team: {
        select: {
          members: {
            where: { userId: auth.user.id },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 100,
  });

  return projects.map(project => toProjectFacade(project, auth));
}

export async function getProject(
  projectId: string,
  auth: Auth,
  scope: ProjectDataScope,
): Promise<ProjectFacade | null> {
  const project = await prisma.client.website.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      domain: true,
      userId: true,
      teamId: true,
    },
  });

  return project ? toProjectFacade(project, auth, scope) : null;
}
