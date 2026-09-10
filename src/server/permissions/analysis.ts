import type { Auth } from '@/lib/types';
import {
  getProjectDataScope,
  PROJECT_DATA_SCOPES,
  type ProjectDataScope,
} from './project-data';
import { getProject } from '../projects/project-service';

export interface AnalysisAccess {
  projectId: string;
  tenantId: string;
  permissionScope: ProjectDataScope;
}

export async function getAnalysisAccess(
  auth: Auth | null | undefined,
  projectId: string,
): Promise<AnalysisAccess | null> {
  if (!auth?.user) return null;

  const permissionScope = await getProjectDataScope(auth, projectId);
  if (permissionScope === PROJECT_DATA_SCOPES.deny) return null;

  const project = await getProject(projectId, auth, permissionScope);
  if (!project) return null;

  return {
    projectId,
    tenantId: project.workspaceId ?? project.id,
    permissionScope,
  };
}
