import { describe, expect, test } from 'vitest';
import { AnalysisValidationError } from './errors';
import { normalizeAnalysisQuery } from './normalize';
import { validAnalysisQuery } from './test-fixtures';
import {
  parseAnalysisQueryUrl,
  resetAnalysisFilters,
  serializeAnalysisQuery,
} from './url-codec';

describe('AnalysisQuery URL codec', () => {
  test.each([
    ['trend', validAnalysisQuery()],
    [
      'breakdown with filters',
      validAnalysisQuery({
        mode: 'breakdown',
        breakdown: { field: 'urlPath', limit: 20 },
        filters: [
          { field: 'urlPath', operator: 'contains', value: '/onboarding?step=1' },
          { field: 'eventName', operator: 'notEquals', value: 'ignored' },
        ],
        comparison: 'none',
        visualization: 'table',
      }),
    ],
  ])('round-trips %s deterministically', (_name, input) => {
    const normalized = normalizeAnalysisQuery(input);
    const encoded = serializeAnalysisQuery(normalized);
    const decoded = parseAnalysisQueryUrl(encoded);

    expect(decoded).toEqual(normalized);
    expect(serializeAnalysisQuery(decoded)).toBe(encoded);
  });

  test('filter insertion order cannot change the canonical URL', () => {
    const left = normalizeAnalysisQuery(
      validAnalysisQuery({
        filters: [
          { field: 'urlPath', operator: 'contains', value: '/app' },
          { field: 'eventName', operator: 'equals', value: 'signup' },
        ],
      }),
    );
    const right = normalizeAnalysisQuery(
      validAnalysisQuery({ filters: [...left.filters].reverse() }),
    );

    expect(serializeAnalysisQuery(left)).toBe(serializeAnalysisQuery(right));
  });

  test('reset removes only filter-owned keys', () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        filters: [{ field: 'eventName', operator: 'equals', value: 'signup' }],
        comparison: 'previousPeriod',
        visualization: 'bar',
      }),
    );
    const params = new URLSearchParams(serializeAnalysisQuery(query));
    params.set('panel', 'table');
    const reset = resetAnalysisFilters(params);

    expect(reset.has('f')).toBe(false);
    expect(reset.has('match')).toBe(false);
    expect(reset.get('start')).toBe(query.range.startAt);
    expect(reset.get('compare')).toBe('previousPeriod');
    expect(reset.get('view')).toBe('bar');
    expect(reset.get('panel')).toBe('table');
  });

  test.each(['', 'aqv=7'])('fails safely for malformed or unknown versions: %s', input => {
    expect(() => parseAnalysisQueryUrl(input)).toThrowError(AnalysisValidationError);
  });
});
