import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import type { QueryFilters } from '@/lib/types';

const FUNCTION_NAME = 'getEventStats';

export interface EventStatsParameters {
  limit?: number | string;
  eventName?: string;
}

interface WebsiteEventMetric {
  x: string;
  t: string;
  y: number;
}

export async function getEventStats(
  ...args: [websiteId: string, parameters: EventStatsParameters, filters: QueryFilters]
): Promise<WebsiteEventMetric[]> {
  return runQuery({
    [PRISMA]: () => getEventStatsPostgresql(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

export async function getEventStatsPostgresql(
  websiteId: string,
  parameters: EventStatsParameters,
  filters: QueryFilters,
) {
  const { limit, eventName } = parameters;
  const { timezone = 'utc', unit = 'day' } = filters;
  const { rawQuery, getDateSQL, parseFilters } = prisma;
  const { filterQuery, cohortQuery, joinSessionQuery, queryParams } = parseFilters({
    ...filters,
    websiteId,
  });

  const limitQuery = limit
    ? `and event_name in (
    select event_name
    from website_event
    where website_id = {{websiteId::uuid}}
      and created_at >= {{startDate}}
      and created_at < {{endDate}}
      and event_type = 2
    group by event_name
    order by count(*) desc
    limit ${limit}
  )`
    : '';
  const eventNameQuery = eventName ? 'and website_event.event_name = {{eventName}}' : '';

  return rawQuery(
    `
    select
      event_name x,
      ${getDateSQL('website_event.created_at', unit, timezone)} t,
      count(*) y
    from website_event
    ${cohortQuery}
    ${joinSessionQuery}
    where website_event.website_id = {{websiteId::uuid}}
      and website_event.created_at >= {{startDate}}
      and website_event.created_at < {{endDate}}
      and website_event.event_type = 2
      ${eventNameQuery}
      ${filterQuery}
      ${limitQuery}
    group by 1, 2
    order by 2
    `,
    { ...queryParams, ...(eventName ? { eventName } : {}) },
    FUNCTION_NAME,
  );
}

async function clickhouseQuery(
  websiteId: string,
  parameters: EventStatsParameters,
  filters: QueryFilters,
): Promise<{ x: string; t: string; y: number }[]> {
  const { limit } = parameters;
  const { timezone = 'UTC', unit = 'day' } = filters;
  const { rawQuery, getDateSQL, parseFilters } = clickhouse;
  const { filterQuery, cohortQuery, queryParams } = parseFilters({
    ...filters,
    websiteId,
  });

  const limitQuery = limit
    ? `and event_name in (
    select event_name
    from website_event
    where website_id = {websiteId:UUID}
      and created_at between {startDate:DateTime64} and {endDate:DateTime64}
      and event_type = 2
    group by event_name
    order by count(*) desc
    limit ${limit}
  )`
    : '';

  let sql = '';

  if (filterQuery || cohortQuery) {
    sql = `
    select
      event_name x,
      ${getDateSQL('created_at', unit, timezone)} t,
      count(*) y
    from website_event
    ${cohortQuery}
    where website_id = {websiteId:UUID}
      and created_at between {startDate:DateTime64} and {endDate:DateTime64}
      and event_type = 2
      ${filterQuery}
      ${limitQuery}
    group by x, t
    order by t
    `;
  } else {
    sql = `
    select
      event_name x,
      ${getDateSQL('created_at', unit, timezone)} t,
      count(*) y
    from (
      select arrayJoin(event_name) as event_name,
        created_at
      from website_event_stats_hourly website_event
      where website_id = {websiteId:UUID}
        and created_at between {startDate:DateTime64} and {endDate:DateTime64}
        and event_type = 2
        ${limitQuery}
    ) as g
    group by x, t
    order by t
    `;
  }

  return rawQuery(sql, queryParams, FUNCTION_NAME);
}
