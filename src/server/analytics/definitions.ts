import type { AnalysisDefinition, AnalysisQueryV1 } from './contracts';

export function getAnalysisDefinitions(query: AnalysisQueryV1): AnalysisDefinition[] {
  const definitions: AnalysisDefinition[] = [
    {
      key: 'range',
      label: `${query.range.unit} buckets`,
      description: `Buckets use ${query.range.timezone}; storage boundaries remain explicit UTC instants.`,
    },
  ];

  if (query.mode === 'funnel' && query.funnel) {
    definitions.unshift(
      {
        key: 'funnel.unit',
        label: 'Funnel actor',
        description:
          'Exact actor identity: distinct_id across sessions when known, otherwise the individual session. Every actor enters once at the first matching step.',
      },
      {
        key: 'funnel.conversion',
        label: 'Ordered conversion',
        description: `Each later step must occur after the prior step and within ${query.funnel.conversionWindowMinutes} minutes of entry. Same-timestamp events are ordered by event ID.`,
      },
      {
        key: 'funnel.dropoff',
        label: 'Drop-off',
        description:
          'Actors reaching the prior step but not the current step; overall conversion uses first-step entrants as denominator.',
      },
    );
  } else if (query.mode === 'retention' && query.retention) {
    definitions.unshift(
      {
        key: 'retention.cohort',
        label: 'Entry cohort',
        description:
          'Each exact actor joins once at its first qualifying entry inside the selected half-open range.',
      },
      {
        key: 'retention.period',
        label: `Exact ${query.retention.granularity} return`,
        description:
          'Period N counts actors with the independent return behavior during that exact calendar period; period 0 is cohort size.',
      },
    );
  } else if (query.measure.source === 'lifecycle') {
    definitions.unshift({
      key: 'signal-studio.home.lifecycle.v1',
      label: `Observed cohort: ${query.measure.key}`,
      description:
        'TrackedUsers only. First signup in the selected range → ordered onboarding_completed → core_feature_used within 7 elapsed days. Retained users repeat core_feature_used in [activation + 7 days, activation + 14 days). Activation rate divides by signups; retention rate divides by activated users. Observation extends 21 days after the cohort range; incomplete horizons are partial. Cohort filters apply at signup. This is not the mutable stored lifecycle trait.',
    });
  } else if (query.measure.source === 'revenue') {
    definitions.unshift({
      key: 'revenue.sum',
      label: `Tracked revenue · ${query.measure.property}`,
      description:
        'Exact sum of recorded Revenue facts linked to qualifying custom events, using revenue created_at in [startAt, endAt). One currency only; no conversion. Recorded refunds retain their sign.',
    });
  } else if (query.measure.aggregation !== 'count') {
    const descriptions = {
      uniqueUsers:
        'Distinct project TrackedUser IDs linked through session distinct_id. Anonymous/unprojected identities are excluded. Totals deduplicate across the whole range, not the sum of buckets.',
      uniqueAccounts:
        'Distinct current AccountMembership account IDs of qualifying TrackedUsers. This uses latest-observed membership, not historical membership. Totals are not the sum of buckets.',
      sessions:
        'Distinct session IDs containing qualifying custom events. Total deduplicates across the whole range.',
      sum: 'Sum of numeric event property values. Missing/non-numeric values are excluded; duplicate numeric rows for one event/property are averaged first.',
      average:
        'Average numeric event property value across events with a numeric value. Duplicate property rows are averaged per event first; absent values are excluded.',
    };
    definitions.unshift({
      key: `event.${query.measure.aggregation}`,
      label: query.measure.aggregation,
      description: descriptions[query.measure.aggregation],
    });
  } else {
    definitions.unshift({
      key: 'event.count',
      label: query.measure.key === '*' ? 'Custom events' : query.measure.key,
      description:
        'Exact count of custom-event fact rows whose created_at is inside the half-open range [startAt, endAt).',
    });
  }

  if (query.breakdown) {
    definitions.push({
      key: `breakdown.${query.breakdown.field}`,
      label: query.breakdown.field,
      description: `Top ${query.breakdown.limit} values, ordered by the selected exact metric.`,
    });
  }

  if (query.comparison === 'previousPeriod') {
    definitions.push({
      key: 'comparison.previousPeriod',
      label: 'Previous period',
      description: 'An equal-duration range immediately before the selected half-open range.',
    });
  }

  if (query.comparison === 'segment' && query.comparisonFilter) {
    const filter = query.comparisonFilter;
    definitions.push({
      key: 'comparison.segment',
      label: 'Selected segment',
      description: `${filter.field} ${filter.operator} ${filter.value}; applied in addition to the base filters.`,
    });
  }

  definitions.push({
    key: 'data.mutability',
    label: 'Observed data',
    description:
      'Late arrivals, identity projection updates and data deletion can change historical results. Computation freshness does not prove ingestion completeness.',
  });
  return definitions;
}
