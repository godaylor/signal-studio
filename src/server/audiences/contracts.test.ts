import { describe, expect, test } from 'vitest';
import { identityListQuerySchema, operationalSegmentDefinitionSchema } from './contracts';

describe('operational audience contracts', () => {
  test('normalizes reproducible identity filters and bounded sort state', () => {
    expect(
      identityListQuerySchema.parse({
        search: 'alice',
        sort: 'lifecycleStage',
        direction: 'asc',
        lifecycle: 'activated',
      }),
    ).toMatchObject({
      search: 'alice',
      sort: 'lifecycleStage',
      direction: 'asc',
      lifecycle: 'activated',
      limit: 50,
    });
  });

  test('allows standard trait and bounded behavior rules but rejects sensitive fields', () => {
    expect(
      operationalSegmentDefinitionSchema.parse({
        version: 1,
        entity: 'user',
        match: 'all',
        conditions: [
          { kind: 'trait', field: 'plan', operator: 'equals', value: 'enterprise' },
          { kind: 'behavior', eventName: 'core_feature_used', withinDays: 30, minCount: 2 },
        ],
      }).conditions,
    ).toHaveLength(2);
    expect(() =>
      operationalSegmentDefinitionSchema.parse({
        version: 1,
        entity: 'user',
        match: 'all',
        conditions: [{ kind: 'trait', field: 'email', operator: 'equals', value: 'secret' }],
      }),
    ).toThrow();
  });
});
