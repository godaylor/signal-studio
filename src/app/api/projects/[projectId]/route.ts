import { parseRequest } from '@/lib/request';
import { forbidden, json, notFound } from '@/lib/response';
import { getProjectDataScope, PROJECT_DATA_SCOPES } from '@/server/permissions/project-data';
import { getProject } from '@/server/projects/project-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { projectId } = await params;
  const scope = await getProjectDataScope(auth, projectId);

  if (scope === PROJECT_DATA_SCOPES.deny) {
    return forbidden({ code: 'project-access-denied' });
  }

  const project = await getProject(projectId, auth, scope);

  return project ? json({ data: project }) : notFound({ code: 'project-not-found' });
}
