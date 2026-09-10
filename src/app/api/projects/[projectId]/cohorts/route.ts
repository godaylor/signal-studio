import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json } from '@/lib/response';
import { CohortForbiddenError, createCohort, listCohorts } from '@/server/cohorts/cohort-service';
import { createCohortSchema } from '@/server/cohorts/contracts';
import { getInsightAccess } from '@/server/permissions/insights';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-cohort-access-denied' });
  return json(await listCohorts(access));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, createCohortSchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-cohort-access-denied' });
  try {
    return json(await createCohort(access, body.name, body.definition));
  } catch (caught) {
    if (caught instanceof CohortForbiddenError)
      return forbidden({ code: 'project-cohort-mutation-denied' });
    if (caught instanceof Error && caught.name === 'ZodError')
      return badRequest({ code: 'cohort-definition-invalid' });
    throw caught;
  }
}
