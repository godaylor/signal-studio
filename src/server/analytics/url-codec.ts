import type { AnalysisBehavior, AnalysisFilter, AnalysisQueryV1 } from './contracts';
import { AnalysisValidationError } from './errors';
import { normalizeAnalysisQuery } from './normalize';

const FILTER_KEY = 'f';
const FILTER_MATCH_KEY = 'match';
const COMPARISON_FILTER_KEY = 'cf';
const FUNNEL_STEP_KEY = 'fs';

function behaviorTuple(behavior: AnalysisBehavior) {
  return [
    behavior.type,
    behavior.value,
    behavior.filters.map(filter => [filter.property, filter.operator, filter.value]),
  ];
}

function parseBehavior(value: string, key: string): AnalysisBehavior {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== 3 || !Array.isArray(parsed[2]))
      throw new TypeError();
    return {
      type: parsed[0],
      value: parsed[1],
      filters: parsed[2].map((filter: unknown) => {
        if (!Array.isArray(filter) || filter.length !== 3) throw new TypeError();
        return { property: filter[0], operator: filter[1], value: filter[2] };
      }),
    } as AnalysisBehavior;
  } catch {
    throw new AnalysisValidationError(
      'analysis-url-behavior-invalid',
      'The URL contains a malformed behavioral definition.',
      { path: [key], hint: 'Remove the malformed behavior or copy the analysis URL again.' },
    );
  }
}

function parseFilter(value: string): AnalysisFilter {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed) || parsed.length !== 3) {
      throw new TypeError('Filter must contain field, operator and value.');
    }

    return { field: parsed[0], operator: parsed[1], value: parsed[2] } as AnalysisFilter;
  } catch {
    throw new AnalysisValidationError(
      'analysis-url-filter-invalid',
      'The URL contains a malformed filter.',
      {
        path: [FILTER_KEY],
        hint: 'Remove the malformed filter or copy the analysis URL again.',
      },
    );
  }
}

function paramsFrom(input: string | URLSearchParams) {
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input);
  }

  const query = input.includes('?') ? input.slice(input.indexOf('?') + 1) : input;
  return new URLSearchParams(query);
}

export function serializeAnalysisQuery(input: AnalysisQueryV1): string {
  const query = normalizeAnalysisQuery(input);
  const params = new URLSearchParams();

  params.append('aqv', String(query.version));
  params.append('project', query.projectId);
  params.append('mode', query.mode);
  params.append('event', query.measure.key);
  if (query.measure.source !== 'event') params.append('source', query.measure.source);
  params.append('aggregation', query.measure.aggregation);
  if (query.measure.property) params.append('property', query.measure.property);
  params.append('start', query.range.startAt);
  params.append('end', query.range.endAt);
  params.append('tz', query.range.timezone);
  params.append('unit', query.range.unit);
  if (query.breakdown) {
    params.append('breakdown', query.breakdown.field);
    params.append('limit', String(query.breakdown.limit));
  }
  params.append('compare', query.comparison);
  if (query.comparisonFilter) {
    const { field, operator, value } = query.comparisonFilter;
    params.append(COMPARISON_FILTER_KEY, JSON.stringify([field, operator, value]));
  }
  params.append('view', query.visualization);
  params.append(FILTER_MATCH_KEY, query.match);
  for (const filter of query.filters) {
    params.append(FILTER_KEY, JSON.stringify([filter.field, filter.operator, filter.value]));
  }
  if (query.funnel) {
    for (const step of query.funnel.steps)
      params.append(FUNNEL_STEP_KEY, JSON.stringify(behaviorTuple(step)));
    params.append('fw', String(query.funnel.conversionWindowMinutes));
  }
  if (query.retention) {
    params.append('entry', JSON.stringify(behaviorTuple(query.retention.entry)));
    params.append('return', JSON.stringify(behaviorTuple(query.retention.returning)));
    params.append('periods', String(query.retention.periods));
    if (query.retention.cohortId) params.append('cohort', query.retention.cohortId);
  }

  return params.toString();
}

export function parseAnalysisQueryUrl(input: string | URLSearchParams): AnalysisQueryV1 {
  const params = paramsFrom(input);
  const version = params.get('aqv');

  if (version !== '1') {
    throw new AnalysisValidationError(
      version ? 'analysis-url-version-unsupported' : 'analysis-url-version-missing',
      version
        ? `Analysis URL version "${version}" is not supported.`
        : 'Analysis URL version is missing.',
      { path: ['aqv'], hint: 'Open or copy an AnalysisQuery v1 URL.' },
    );
  }

  const breakdownField = params.get('breakdown');
  const limit = params.get('limit');

  return normalizeAnalysisQuery({
    version: 1,
    projectId: params.get('project'),
    mode: params.get('mode'),
    range: {
      startAt: params.get('start'),
      endAt: params.get('end'),
      timezone: params.get('tz'),
      unit: params.get('unit'),
    },
    measure: {
      source: params.get('source') ?? 'event',
      key: params.get('event'),
      aggregation: params.get('aggregation'),
      ...(params.get('property') ? { property: params.get('property') } : {}),
    },
    ...(breakdownField
      ? { breakdown: { field: breakdownField, limit: limit ? Number(limit) : undefined } }
      : {}),
    filters: params.getAll(FILTER_KEY).map(parseFilter),
    match: params.get(FILTER_MATCH_KEY) ?? undefined,
    comparison: params.get('compare') ?? undefined,
    ...(params.get(COMPARISON_FILTER_KEY)
      ? { comparisonFilter: parseFilter(params.get(COMPARISON_FILTER_KEY) as string) }
      : {}),
    visualization: params.get('view') ?? undefined,
    ...(params.getAll(FUNNEL_STEP_KEY).length
      ? {
          funnel: {
            steps: params
              .getAll(FUNNEL_STEP_KEY)
              .map(value => parseBehavior(value, FUNNEL_STEP_KEY)),
            conversionWindowMinutes: Number(params.get('fw')),
          },
        }
      : {}),
    ...(params.get('entry') && params.get('return')
      ? {
          retention: {
            entry: parseBehavior(params.get('entry') as string, 'entry'),
            returning: parseBehavior(params.get('return') as string, 'return'),
            granularity: params.get('unit'),
            periods: Number(params.get('periods')),
            ...(params.get('cohort') ? { cohortId: params.get('cohort') } : {}),
          },
        }
      : {}),
  });
}

export function resetAnalysisFilters(input: string | URLSearchParams): URLSearchParams {
  const params = paramsFrom(input);
  params.delete(FILTER_KEY);
  params.delete(FILTER_MATCH_KEY);
  return params;
}
