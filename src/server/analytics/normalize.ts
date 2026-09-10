import {
  ANALYSIS_MAX_HOURLY_RANGE_DAYS,
  ANALYSIS_MAX_RANGE_DAYS,
  type AnalysisFilter,
  type AnalysisQueryV1,
  analysisQueryV1Schema,
} from './contracts';
import { AnalysisValidationError } from './errors';

const DAY_MS = 24 * 60 * 60 * 1000;
const supportedBreakdowns = new Set(['eventName', 'urlPath']);
const supportedFunnelBreakdowns = new Set(['browser', 'os', 'device', 'country']);
const supportedFilterFields = new Set([
  'eventName',
  'urlPath',
  'browser',
  'os',
  'device',
  'country',
]);
const equalityOnlyFields = new Set(['country']);

function canonicalTimezone(timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    throw new AnalysisValidationError(
      'analysis-timezone-invalid',
      `Timezone "${timezone}" is not a valid IANA timezone.`,
      { path: ['range', 'timezone'], hint: 'Use an IANA name such as UTC or America/New_York.' },
    );
  }
}

function stableFilterOrder(left: AnalysisFilter, right: AnalysisFilter) {
  return `${left.field}\u0000${left.operator}\u0000${left.value}`.localeCompare(
    `${right.field}\u0000${right.operator}\u0000${right.value}`,
  );
}

function schemaError(input: unknown) {
  const result = analysisQueryV1Schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const issue = result.error.issues[0];
  const version =
    typeof input === 'object' && input !== null && 'version' in input
      ? (input as { version?: unknown }).version
      : undefined;

  if (version !== undefined && version !== 1) {
    throw new AnalysisValidationError(
      'analysis-version-unsupported',
      `AnalysisQuery version "${String(version)}" is not supported.`,
      { path: ['version'], hint: 'Use AnalysisQuery version 1.' },
    );
  }

  throw new AnalysisValidationError('analysis-query-invalid', issue.message, {
    path: issue.path.map(segment => (typeof segment === 'symbol' ? String(segment) : segment)),
    hint: 'Correct the highlighted AnalysisQuery field and retry.',
  });
}

export function normalizeAnalysisQuery(input: unknown): AnalysisQueryV1 {
  const query = schemaError(input);
  const startAt = new Date(query.range.startAt);
  const endAt = new Date(query.range.endAt);
  const duration = endAt.getTime() - startAt.getTime();

  if (duration <= 0) {
    throw new AnalysisValidationError(
      'analysis-range-invalid',
      'Analysis range must use half-open boundaries with startAt before endAt.',
      { path: ['range'], hint: 'Choose an end instant later than the start instant.' },
    );
  }

  if (duration > ANALYSIS_MAX_RANGE_DAYS * DAY_MS) {
    throw new AnalysisValidationError(
      'analysis-range-too-large',
      `AnalysisQuery v1 supports at most ${ANALYSIS_MAX_RANGE_DAYS} days.`,
      { path: ['range'], hint: 'Shorten the date range and retry.' },
    );
  }

  if (query.range.unit === 'hour' && duration > ANALYSIS_MAX_HOURLY_RANGE_DAYS * DAY_MS) {
    throw new AnalysisValidationError(
      'analysis-hourly-range-too-large',
      `Hourly analysis supports at most ${ANALYSIS_MAX_HOURLY_RANGE_DAYS} days.`,
      { path: ['range', 'unit'], hint: 'Use day, week or month buckets for this range.' },
    );
  }

  if (query.range.unit === 'hour' && query.range.timezone.toUpperCase() !== 'UTC') {
    throw new AnalysisValidationError(
      'analysis-hourly-timezone-unsupported',
      'Hourly AnalysisQuery v1 buckets require UTC to avoid ambiguous DST fall-back labels.',
      {
        path: ['range', 'timezone'],
        hint: 'Use UTC for hourly buckets or choose day/month buckets for an IANA timezone.',
      },
    );
  }

  if (
    ['funnel', 'retention'].includes(query.mode) &&
    (query.measure.aggregation !== 'count' || query.measure.source !== 'event')
  ) {
    throw new AnalysisValidationError(
      'analysis-aggregation-unsupported',
      `Aggregation "${query.measure.aggregation}" is not available in AnalysisQuery v1 execution.`,
      {
        path: ['measure', 'aggregation'],
        hint: 'Behavioral funnel/retention requires event count.',
      },
    );
  }

  if (
    query.measure.source === 'revenue' &&
    (query.measure.aggregation !== 'sum' || !/^[A-Z]{3}$/.test(query.measure.property ?? ''))
  ) {
    throw new AnalysisValidationError(
      'analysis-revenue-currency-required',
      'Tracked revenue requires sum and an explicit three-letter currency property.',
      { path: ['measure'] },
    );
  }
  if (
    query.measure.source === 'event' &&
    ['sum', 'average'].includes(query.measure.aggregation) &&
    !query.measure.property
  ) {
    throw new AnalysisValidationError(
      'analysis-numeric-property-required',
      'Numeric aggregation requires an explicit event property.',
      { path: ['measure', 'property'] },
    );
  }
  if (query.measure.source === 'lifecycle') {
    if (
      query.mode !== 'trend' ||
      query.measure.aggregation !== 'count' ||
      !['signup', 'activated', 'retained'].includes(query.measure.key) ||
      query.measure.property ||
      query.filters.some(filter => ['eventName', 'urlPath'].includes(filter.field)) ||
      (query.comparisonFilter && ['eventName', 'urlPath'].includes(query.comparisonFilter.field))
    ) {
      throw new AnalysisValidationError(
        'analysis-lifecycle-definition-invalid',
        'Lifecycle uses trend/count, signup/activated/retained, and optional session-dimension filters.',
        { path: ['measure'] },
      );
    }
  }

  const allowedBreakdowns =
    query.mode === 'funnel' ? supportedFunnelBreakdowns : supportedBreakdowns;
  if (query.breakdown && !allowedBreakdowns.has(query.breakdown.field)) {
    throw new AnalysisValidationError(
      'analysis-breakdown-unsupported',
      `Breakdown "${query.breakdown.field}" is not available in AnalysisQuery v1 execution.`,
      {
        path: ['breakdown', 'field'],
        hint:
          query.mode === 'funnel'
            ? 'Use browser, OS, device or country for a bounded funnel breakdown.'
            : 'Use eventName or urlPath.',
      },
    );
  }

  if (['funnel', 'retention'].includes(query.mode) && query.comparison === 'previousPeriod') {
    throw new AnalysisValidationError(
      'analysis-advanced-previous-period-unsupported',
      'Funnels and retention compare typed segments rather than shifting the observation window.',
      { path: ['comparison'], hint: 'Use no comparison or select one typed segment.' },
    );
  }

  if (query.mode === 'retention' && query.range.unit !== query.retention?.granularity) {
    throw new AnalysisValidationError(
      'analysis-retention-granularity-mismatch',
      'Retention range unit and cohort granularity must match.',
      {
        path: ['range', 'unit'],
        hint: 'Use the same day, week or month granularity in both fields.',
      },
    );
  }

  for (const [index, filter] of query.filters.entries()) {
    if (!supportedFilterFields.has(filter.field)) {
      throw new AnalysisValidationError(
        'analysis-filter-field-unsupported',
        `Filter field "${filter.field}" is not available in AnalysisQuery v1 execution.`,
        { path: ['filters', index, 'field'], hint: 'Use eventName or urlPath.' },
      );
    }

    if (
      equalityOnlyFields.has(filter.field) &&
      !['equals', 'notEquals'].includes(filter.operator)
    ) {
      throw new AnalysisValidationError(
        'analysis-filter-operator-unsupported',
        `Operator "${filter.operator}" is not valid for ${filter.field}.`,
        { path: ['filters', index, 'operator'], hint: 'Use equals or notEquals.' },
      );
    }
  }

  if (query.comparisonFilter) {
    const filter = query.comparisonFilter;

    if (!supportedFilterFields.has(filter.field)) {
      throw new AnalysisValidationError(
        'analysis-comparison-field-unsupported',
        `Comparison field "${filter.field}" is not available in AnalysisQuery v1 execution.`,
        { path: ['comparisonFilter', 'field'], hint: 'Use an available typed dimension.' },
      );
    }

    if (
      equalityOnlyFields.has(filter.field) &&
      !['equals', 'notEquals'].includes(filter.operator)
    ) {
      throw new AnalysisValidationError(
        'analysis-comparison-operator-unsupported',
        `Operator "${filter.operator}" is not valid for ${filter.field}.`,
        {
          path: ['comparisonFilter', 'operator'],
          hint: 'Use equals or notEquals for this dimension.',
        },
      );
    }

    if (query.match === 'any' && query.filters.length > 0) {
      throw new AnalysisValidationError(
        'analysis-segment-grouping-unsupported',
        'Segment comparison cannot safely group a match:any base filter set.',
        {
          path: ['match'],
          hint: 'Use match:all or remove the base filters before comparing a segment.',
        },
      );
    }
  }

  if (
    query.mode === 'breakdown' &&
    query.measure.key !== '*' &&
    query.match === 'any' &&
    query.filters.length > 0
  ) {
    throw new AnalysisValidationError(
      'analysis-match-combination-unsupported',
      'A specific event measure cannot yet combine with match:any filters in breakdown mode.',
      {
        path: ['match'],
        hint: 'Use match:all, remove the filters, or analyze all custom events with key "*".',
      },
    );
  }

  return {
    ...query,
    range: {
      ...query.range,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      timezone: canonicalTimezone(query.range.timezone),
    },
    measure: { ...query.measure },
    ...(query.breakdown ? { breakdown: { ...query.breakdown } } : {}),
    ...(query.comparisonFilter ? { comparisonFilter: { ...query.comparisonFilter } } : {}),
    ...(query.funnel
      ? {
          funnel: {
            ...query.funnel,
            steps: query.funnel.steps.map(step => ({
              ...step,
              filters: step.filters
                .map(filter => ({ ...filter }))
                .toSorted((left, right) =>
                  `${left.property}\u0000${left.operator}\u0000${left.value}`.localeCompare(
                    `${right.property}\u0000${right.operator}\u0000${right.value}`,
                  ),
                ),
            })),
          },
        }
      : {}),
    ...(query.retention
      ? {
          retention: {
            ...query.retention,
            entry: {
              ...query.retention.entry,
              filters: query.retention.entry.filters.map(filter => ({ ...filter })),
            },
            returning: {
              ...query.retention.returning,
              filters: query.retention.returning.filters.map(filter => ({ ...filter })),
            },
          },
        }
      : {}),
    filters: query.filters.map(filter => ({ ...filter })).toSorted(stableFilterOrder),
  };
}
