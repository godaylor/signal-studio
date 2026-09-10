import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import type { QueryFilters } from '@/lib/types';

const FUNCTION_NAME = 'getRealtimeActivity';

export async function getRealtimeActivity(...args: [websiteId: string, filters: QueryFilters]) {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(websiteId: string, filters: QueryFilters) {
  const { rawQuery, parseFilters } = prisma;
  const { queryParams, filterQuery, cohortQuery, dateQuery } = parseFilters({
    ...filters,
    websiteId,
  });

  return rawQuery(
    `
    select
        website_event.session_id as "sessionId",
        website_event.event_name as "eventName",
        website_event.created_at as "createdAt",
        tracked_user.tracked_user_id as "trackedUserId",
        account_membership.tracked_account_id as "trackedAccountId",
        session.browser,
        session.os,
        session.device,
        session.country,
        website_event.url_path as "urlPath",
        website_event.referrer_domain as "referrerDomain",
        website_event.hostname
    from website_event
    ${cohortQuery}
    inner join session
      on session.session_id = website_event.session_id
        and session.website_id = website_event.website_id
    left join tracked_user
      on tracked_user.project_id = website_event.website_id
        and tracked_user.external_id = session.distinct_id
    left join account_membership
      on account_membership.project_id = website_event.website_id
        and account_membership.tracked_user_id = tracked_user.tracked_user_id
    where website_event.website_id = {{websiteId::uuid}}
      and website_event.event_type != ${EVENT_TYPE.performance}
    ${filterQuery}
    ${dateQuery}
    order by website_event.created_at desc
    limit 100
    `,
    queryParams,
    FUNCTION_NAME,
  );
}

async function clickhouseQuery(websiteId: string, filters: QueryFilters): Promise<{ x: number }> {
  const { rawQuery, parseFilters } = clickhouse;
  const { queryParams, filterQuery, cohortQuery, dateQuery } = parseFilters({
    ...filters,
    websiteId,
  });

  return rawQuery(
    `
        select
            session_id as sessionId,
            event_name as eventName,
            created_at as createdAt,
            NULL as trackedUserId,
            NULL as trackedAccountId,
            browser,
            os,
            device,
            country,
            url_path as urlPath,
            referrer_domain as referrerDomain,
            hostname
        from website_event
        ${cohortQuery}
        where website_id = {websiteId:UUID}
          and event_type != ${EVENT_TYPE.performance}
        ${filterQuery}
        ${dateQuery}
        order by createdAt desc
        limit 100
    `,
    queryParams,
    FUNCTION_NAME,
  );
}
