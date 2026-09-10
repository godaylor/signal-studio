import { createHash } from 'node:crypto';
import type { AnalysisQueryV1 } from './contracts';

export interface AnalysisCacheKeyInput {
  tenantId: string;
  projectId: string;
  permissionScope: string;
  query: AnalysisQueryV1;
  adapter: string;
  exactness: string;
  dataVersion?: string;
}

export function buildAnalysisCacheKey({
  tenantId,
  projectId,
  permissionScope,
  query,
  adapter,
  exactness,
  dataVersion = '1',
}: AnalysisCacheKeyInput) {
  const canonical = JSON.stringify({
    contractVersion: query.version,
    tenantId,
    projectId,
    permissionScope,
    adapter,
    exactness,
    dataVersion,
    query,
  });

  return `analysis:v1:${createHash('sha256').update(canonical).digest('hex')}`;
}
