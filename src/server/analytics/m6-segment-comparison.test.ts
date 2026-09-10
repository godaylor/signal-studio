import { describe, expect, test } from 'vitest';
import { getAnalysisDefinitions } from './definitions';
import { normalizeAnalysisQuery } from './normalize';
import { planAnalysisQuery } from './planner';
import { validAnalysisQuery } from './test-fixtures';
import { parseAnalysisQueryUrl, serializeAnalysisQuery } from './url-codec';

describe('M6 segment comparison', () => {
  const comparisonFilter = {
    field: 'urlPath' as const,
    operator: 'contains' as const,
    value: '/app',
  };

  test('round-trips one typed segment through the stable URL codec', () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        comparison: 'segment',
        comparisonFilter,
      }),
    );
    const encoded = serializeAnalysisQuery(query);

    expect(encoded).toContain('compare=segment');
    expect(encoded).toContain('cf=');
    expect(serializeAnalysisQuery(parseAnalysisQueryUrl(encoded))).toBe(encoded);
  });

  test('plans the selected segment as base filters AND one comparison filter', () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        filters: [{ field: 'country', operator: 'equals', value: 'US' }],
        comparison: 'segment',
        comparisonFilter,
      }),
    );
    const plan = planAnalysisQuery(query);

    expect(plan.comparisonQuery).toMatchObject({
      comparison: 'none',
      match: 'all',
      filters: [{ field: 'country', operator: 'equals', value: 'US' }, comparisonFilter],
    });
    expect(plan.comparisonQuery).not.toHaveProperty('comparisonFilter');
  });

  test('rejects unsafe match:any grouping and incompatible typed operators', () => {
    expect(() =>
      normalizeAnalysisQuery(
        validAnalysisQuery({
          match: 'any',
          filters: [{ field: 'urlPath', operator: 'contains', value: '/docs' }],
          comparison: 'segment',
          comparisonFilter,
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'analysis-segment-grouping-unsupported' }));

    expect(() =>
      normalizeAnalysisQuery(
        validAnalysisQuery({
          comparison: 'segment',
          comparisonFilter: {
            field: 'country',
            operator: 'contains',
            value: 'US',
          },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'analysis-comparison-operator-unsupported' }));
  });

  test('publishes comparison semantics with the result definitions', () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({ comparison: 'segment', comparisonFilter }),
    );

    expect(getAnalysisDefinitions(query)).toContainEqual({
      key: 'comparison.segment',
      label: 'Selected segment',
      description: 'urlPath contains /app; applied in addition to the base filters.',
    });
  });
});
