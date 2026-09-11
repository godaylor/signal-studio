import prisma from '@/lib/prisma';
import type { PrismaClient } from '@/generated/prisma/client';
import type {
  AnalysisBreakdownRow,
  AnalysisQueryV1,
  AnalysisTotal,
  AnalysisTrendRow,
} from '../contracts';

const columns = {
  eventName: 'we.event_name',
  urlPath: 'we.url_path',
  browser: 's.browser',
  os: 's.os',
  device: 's.device',
  country: 's.country',
} as const;

function filters(query: AnalysisQueryV1, params: Record<string, unknown>) {
  const clauses = query.filters.map((filter, index) => {
    const key = `filter${index}`;
    params[key] = filter.value;
    const column = `coalesce(${columns[filter.field]}, '')`;
    if (filter.operator === 'contains') return `strpos(lower(${column}), lower({{${key}}})) > 0`;
    if (filter.operator === 'doesNotContain')
      return `strpos(lower(${column}), lower({{${key}}})) = 0`;
    return `${column} ${filter.operator === 'equals' ? '=' : '<>'} {{${key}}}`;
  });
  return clauses.length ? `and (${clauses.join(query.match === 'all' ? ' and ' : ' or ')})` : '';
}

function lifecycleCte(query: AnalysisQueryV1, params: Record<string, unknown>) {
  // Scope the cohort at signup. Later behavior is not accidentally filtered away.
  return `events as materialized (
    select we.event_id, we.created_at, we.event_name, tu.tracked_user_id as user_id,
      we.session_id
    from website_event we
    join session s on s.session_id = we.session_id and s.website_id = we.website_id
    join tracked_user tu on tu.project_id = we.website_id and tu.external_id = nullif(s.distinct_id, '')
    where we.website_id = {{projectId::uuid}} and we.event_type = 2
      and we.created_at >= {{startAt}} and we.created_at < {{observationEnd}}
      and we.event_name in ('signup', 'onboarding_completed', 'core_feature_used')
  ), entrants as (
    select distinct on (e.user_id) e.*
    from events e
    join website_event we on we.event_id = e.event_id and we.website_id = {{projectId::uuid}}
    join session s on s.session_id = e.session_id and s.website_id = {{projectId::uuid}}
    where e.event_name = 'signup' and e.created_at < {{endAt}} ${filters(query, params)}
    order by e.user_id, e.created_at, e.event_id
  ), onboarding as (
    select distinct on (o.user_id) o.user_id, o.created_at, o.event_id, e.created_at as signup_at
    from events o join entrants e on e.user_id = o.user_id
    where o.event_name = 'onboarding_completed'
      and (o.created_at, o.event_id) > (e.created_at, e.event_id)
      and o.created_at < e.created_at + interval '7 days'
    order by o.user_id, o.created_at, o.event_id
  ), activation as (
    select a.user_id, min(a.created_at) as created_at
    from events a join onboarding o on o.user_id = a.user_id
    where a.event_name = 'core_feature_used'
      and (a.created_at, a.event_id) > (o.created_at, o.event_id)
      and a.created_at < o.signup_at + interval '7 days'
    group by a.user_id
  ), retained_users as (
    select a.user_id from activation a
    join tracked_user tu on tu.tracked_user_id = a.user_id and tu.project_id = {{projectId::uuid}}
    join lateral (
      select 1 from session s
      join website_event r on r.session_id = s.session_id and r.website_id = s.website_id
      where s.website_id = {{projectId::uuid}} and s.distinct_id = tu.external_id
        and r.event_type = 2 and r.event_name = 'core_feature_used'
        and r.created_at >= a.created_at + interval '7 days'
        and r.created_at < a.created_at + interval '14 days'
      limit 1
    ) observed_return on true
  ), journeys as (
    select e.user_id, e.created_at, a.created_at as activated_at, r.user_id is not null as retained
    from entrants e left join activation a on a.user_id = e.user_id
    left join retained_users r on r.user_id = e.user_id
  ), facts as (
    select date_trunc({{unit}}, created_at at time zone {{timezone}})::text as label,
      ${query.measure.key === 'signup' ? '1' : query.measure.key === 'activated' ? '(activated_at is not null)::int' : 'retained::int'} as amount,
      ${query.measure.key === 'retained' ? '(activated_at is not null)::int' : '1'} as denominator
    from journeys
  )`;
}

function metricCte(query: AnalysisQueryV1, params: Record<string, unknown>) {
  const revenue = query.measure.source === 'revenue';
  const time = revenue ? 'r.created_at' : 'we.created_at';
  const label =
    query.mode === 'trend'
      ? `date_trunc({{unit}}, ${time} at time zone {{timezone}})::text`
      : `coalesce(${columns[query.breakdown!.field]}, '(not set)')`;
  const amount = revenue
    ? 'r.revenue'
    : ['sum', 'average'].includes(query.measure.aggregation)
      ? 'property.amount'
      : '1';
  if (!revenue && ['uniqueUsers', 'uniqueAccounts', 'sessions'].includes(query.measure.aggregation)) {
    const sessionFilters = query.filters.some(filter => ['browser', 'os', 'device', 'country'].includes(filter.field)) ||
      (query.mode === 'breakdown' && ['browser', 'os', 'device', 'country'].includes(query.breakdown!.field));
    return `matching_sessions as materialized (
      select distinct ${label} as label, we.session_id
      from website_event we
      ${sessionFilters ? 'join session s on s.session_id = we.session_id and s.website_id = we.website_id' : ''}
      where we.website_id = {{projectId::uuid}} and we.event_type = 2
        and we.created_at >= {{startAt}} and we.created_at < {{endAt}}
        ${query.measure.key !== '*' ? 'and we.event_name = {{eventKey}}' : ''}
        ${filters(query, params)}
    ), facts as (
      select e.label, e.session_id, tu.tracked_user_id as user_id,
        ${query.measure.aggregation === 'uniqueAccounts' ? 'membership.tracked_account_id' : 'null::uuid'} as account_id
      from matching_sessions e
      join session s on s.session_id = e.session_id and s.website_id = {{projectId::uuid}}
      left join tracked_user tu on tu.project_id = s.website_id and tu.external_id = nullif(s.distinct_id, '')
      ${query.measure.aggregation === 'uniqueAccounts' ? 'left join account_membership membership on membership.project_id = tu.project_id and membership.tracked_user_id = tu.tracked_user_id' : ''}
    )`;
  }
  return `facts as (
    select ${label} as label, we.session_id, ${amount} as amount
    from ${revenue ? 'revenue r join website_event we on we.website_id = r.website_id and we.event_id = r.event_id and we.session_id = r.session_id' : 'website_event we'}
    join session s on s.session_id = we.session_id and s.website_id = we.website_id
    ${
      !revenue && ['sum', 'average'].includes(query.measure.aggregation)
        ? `left join lateral (
      select avg(ed.number_value) as amount from event_data ed
      where ed.website_id = we.website_id and ed.website_event_id = we.event_id and ed.data_key = {{property}}
    ) property on true`
        : ''
    }
    where we.website_id = {{projectId::uuid}} and we.event_type = 2
      and ${time} >= {{startAt}} and ${time} < {{endAt}}
      ${query.measure.key !== '*' ? 'and we.event_name = {{eventKey}}' : ''}
      ${revenue ? 'and r.currency = {{property}}' : ''}
      ${filters(query, params)}
  )`;
}

type SqlRow = {
  label: string | null;
  value: number | string;
  denominator: number | string | null;
  total: number;
};

export function buildMetricStatement(query: AnalysisQueryV1) {
  const lifecycle = query.measure.source === 'lifecycle';
  const params: Record<string, unknown> = {
    projectId: query.projectId,
    startAt: new Date(query.range.startAt),
    endAt: new Date(query.range.endAt),
    observationEnd: new Date(new Date(query.range.endAt).getTime() + 21 * 86_400_000),
    timezone: query.range.timezone,
    unit: query.range.unit,
    eventKey: query.measure.key,
    property: query.measure.property,
    limit: query.breakdown?.limit ?? 900,
  };
  const cte = lifecycle ? lifecycleCte(query, params) : metricCte(query, params);
  const expressions = {
    count: 'count(*)',
    uniqueUsers: 'count(distinct user_id)',
    uniqueAccounts: 'count(distinct account_id)',
    sessions: 'count(distinct session_id)',
    sum: 'coalesce(sum(amount), 0)',
    average: 'coalesce(avg(amount), 0)',
  };
  const aggregate = lifecycle ? 'coalesce(sum(amount), 0)' : expressions[query.measure.aggregation];
  const selectedRows = query.mode === 'trend' ? `
    select * from grouped where total = 1
    union all
    select bucket.value::text as label, coalesce(g.value, 0) as value,
      coalesce(g.denominator, 0) as denominator, 0 as total
    from generate_series(
      date_trunc({{unit}}, {{startAt}}::timestamptz at time zone {{timezone}}),
      date_trunc({{unit}}, ({{endAt}}::timestamptz - interval '1 microsecond') at time zone {{timezone}}),
      ('1 ' || {{unit}})::interval
    ) bucket(value)
    left join grouped g on g.label = bucket.value::text and g.total = 0
  ` : 'select * from grouped';
  const template = `with ${cte}, grouped as (
      select label, ${aggregate} as value,
        ${lifecycle ? 'coalesce(sum(denominator), 0)' : 'null::bigint'} as denominator,
        grouping(label) as total
      from facts group by grouping sets ((label), ())
    ), selected_rows as (${selectedRows})
    select * from selected_rows
    order by total desc, ${query.mode === 'trend' ? 'label asc' : 'value desc, label asc'}
    limit {{limit}} + 1`;
  const values: unknown[] = [];
  const sql = template.replaceAll(/\{\{(\w+)(::\w+)?}}/g, (_match, key: string, cast = '') => {
    values.push(params[key]);
    return `$${values.length}${cast}`;
  });
  return { sql, values };
}

export async function executeMetricPostgresql(query: AnalysisQueryV1): Promise<{
  rows: AnalysisTrendRow[] | AnalysisBreakdownRow[];
  total: AnalysisTotal;
}> {
  const lifecycle = query.measure.source === 'lifecycle';
  const { sql, values } = buildMetricStatement(query);
  const db = ('$primary' in prisma.client ? prisma.client.$primary() : prisma.client) as PrismaClient;
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
    return tx.$queryRawUnsafe<SqlRow[]>(sql, ...values);
  }, { timeout: 20_000 });
  const total = result.find(row => Number(row.total) === 1);
  const value = Number(total?.value ?? 0);
  const denominator = Number(total?.denominator ?? 0);
  return {
    total: {
      value,
      ...(lifecycle ? { denominator, rate: denominator ? value / denominator : null } : {}),
    },
    rows: result
      .filter(row => Number(row.total) === 0)
      .map(row =>
        query.mode === 'trend'
          ? { bucket: String(row.label), value: Number(row.value) }
          : { key: String(row.label), value: Number(row.value) },
      ) as AnalysisTrendRow[] | AnalysisBreakdownRow[],
  };
}
