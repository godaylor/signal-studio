import { describe, expect, test } from 'vitest';
import type { AnalysisValidationError } from './errors';
import { normalizeAnalysisQuery } from './normalize';
import { validAnalysisQuery } from './test-fixtures';

describe('normalizeAnalysisQuery', () => {
  test('normalizes instants, defaults and stable filter order', () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        filters: [
          { field: 'urlPath', operator: 'contains', value: '/app' },
          { field: 'eventName', operator: 'equals', value: 'signup' },
        ],
      }),
    );

    expect(query.range).toEqual({
      startAt: '2026-03-07T05:00:00.000Z',
      endAt: '2026-03-11T04:00:00.000Z',
      timezone: 'America/New_York',
      unit: 'day',
    });
    expect(query.filters.map(filter => filter.field)).toEqual(['eventName', 'urlPath']);
  });

  test.each([
    {
      name: 'unknown version',
      input: validAnalysisQuery({ version: 2 }),
      code: 'analysis-version-unsupported',
    },
    {
      name: 'unbounded range',
      input: validAnalysisQuery({
        range: {
          startAt: '2024-01-01T00:00:00.000Z',
          endAt: '2026-01-02T00:00:00.000Z',
          timezone: 'UTC',
          unit: 'day',
        },
      }),
      code: 'analysis-range-too-large',
    },
    {
      name: 'ambiguous hourly DST timezone',
      input: validAnalysisQuery({
        range: {
          startAt: '2026-03-07T05:00:00.000Z',
          endAt: '2026-03-08T05:00:00.000Z',
          timezone: 'America/New_York',
          unit: 'hour',
        },
      }),
      code: 'analysis-hourly-timezone-unsupported',
    },
    {
      name: 'unsupported aggregation',
      input: validAnalysisQuery({
        mode: 'funnel',
        funnel: {
          steps: [
            { type: 'event', value: 'signup', filters: [] },
            { type: 'event', value: 'purchase', filters: [] },
          ],
          conversionWindowMinutes: 60,
        },
        measure: { source: 'event', key: 'signup', aggregation: 'uniqueUsers' },
      }),
      code: 'analysis-aggregation-unsupported',
    },
    {
      name: 'unsupported operator',
      input: validAnalysisQuery({
        filters: [{ field: 'country', operator: 'contains', value: 'U' }],
      }),
      code: 'analysis-filter-operator-unsupported',
    },
  ])('returns actionable validation for $name', ({ input, code }) => {
    expect(() => normalizeAnalysisQuery(input)).toThrowError(
      expect.objectContaining<Partial<AnalysisValidationError>>({ code }),
    );
  });
});
