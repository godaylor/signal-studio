import { describe, expect, test } from 'vitest';
import { buildAnalysisCacheKey } from './cache-key';
import { normalizeAnalysisQuery } from './normalize';
import { validAnalysisQuery } from './test-fixtures';

describe('analysis cache key isolation', () => {
  const query = normalizeAnalysisQuery(validAnalysisQuery());
  const base = {
    tenantId: 'tenant-a',
    projectId: query.projectId,
    permissionScope: 'identity-standard',
    query,
    adapter: 'postgresql',
    exactness: 'exact',
  };

  test.each([
    ['tenant', { tenantId: 'tenant-b' }],
    ['project', { projectId: '22222222-2222-4222-8222-222222222222' }],
    ['permission scope', { permissionScope: 'identity-sensitive' }],
    ['adapter', { adapter: 'clickhouse' }],
    ['exactness', { exactness: 'approximate' }],
  ])('isolates by %s', (_name, override) => {
    expect(buildAnalysisCacheKey({ ...base, ...override })).not.toBe(buildAnalysisCacheKey(base));
  });

  test('does not expose raw filter values in the key', () => {
    const key = buildAnalysisCacheKey(base);
    expect(key).toMatch(/^analysis:v1:[a-f0-9]{64}$/);
    expect(key).not.toContain('signup');
  });
});
