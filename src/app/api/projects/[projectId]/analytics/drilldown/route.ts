import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json } from '@/lib/response';
import {
  type AnalysisMemberSelection,
  getAdvancedAnalysisMembers,
} from '@/server/analytics/adapters/advanced-postgresql';
import { AnalysisValidationError } from '@/server/analytics/errors';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
import { getAnalysisAccess } from '@/server/permissions/analysis';
import { PROJECT_DATA_SCOPES } from '@/server/permissions/project-data';

const requestSchema = z.object({
  query: z.record(z.string(), z.unknown()),
  selection: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('funnel-step'),
      step: z.number().int().min(1).max(8),
      outcome: z.enum(['reached', 'dropped']),
    }),
    z.object({
      kind: z.literal('retention-cell'),
      cohortStart: z.string().min(1).max(32),
      period: z.number().int().min(0).max(12),
    }),
  ]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, requestSchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await getAnalysisAccess(auth, projectId);
  if (!access || access.permissionScope !== PROJECT_DATA_SCOPES.sensitive) {
    return forbidden({ code: 'project-analysis-members-access-denied' });
  }
  try {
    const query = normalizeAnalysisQuery(body.query);
    if (query.projectId !== projectId) {
      throw new AnalysisValidationError(
        'analysis-project-mismatch',
        'AnalysisQuery projectId does not match the route project.',
      );
    }
    return json(await getAdvancedAnalysisMembers(query, body.selection as AnalysisMemberSelection));
  } catch (caught) {
    if (caught instanceof AnalysisValidationError) {
      return badRequest({ code: caught.code, message: caught.message, details: caught.details });
    }
    throw caught;
  }
}
