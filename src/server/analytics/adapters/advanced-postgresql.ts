import prisma from '@/lib/prisma';
import type {
  AnalysisBehavior,
  AnalysisFilter,
  AnalysisFunnelDurationRow,
  AnalysisFunnelStepRow,
  AnalysisFunnelTrendRow,
  AnalysisQueryV1,
  AnalysisRetentionRow,
  AnalysisRows,
} from '../contracts';
import { AnalysisValidationError } from '../errors';

type EventRow = {
  eventId: string;
  sessionId: string;
  actorId: string;
  distinctId: string | null;
  createdAt: Date | string;
  eventName: string | null;
  urlPath: string;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  properties: Record<string, unknown> | null;
};

type ActorJourney = { actorId: string; events: EventRow[]; reached: EventRow[] };

export type AnalysisMemberSelection =
  | { kind: 'funnel-step'; step: number; outcome: 'reached' | 'dropped' }
  | { kind: 'retention-cell'; cohortStart: string; period: number };

export type AnalysisMember = {
  actorId: string;
  trackedUser: { id: string; externalId: string; displayName: string | null } | null;
  account: { id: string; externalId: string; name: string | null } | null;
  sessionIds: string[];
};

const dimensionColumns = {
  eventName: 'we.event_name',
  urlPath: 'we.url_path',
  browser: 's.browser',
  os: 's.os',
  device: 's.device',
  country: 's.country',
} as const;

function filterSql(
  filters: AnalysisFilter[],
  match: 'all' | 'any',
  params: Record<string, unknown>,
) {
  if (!filters.length) return '';
  const clauses = filters.map((filter, index) => {
    const name = `global_${index}`;
    const column = dimensionColumns[filter.field];
    params[name] = ['contains', 'doesNotContain'].includes(filter.operator)
      ? `%${filter.value}%`
      : filter.value;
    const operator =
      filter.operator === 'equals'
        ? '='
        : filter.operator === 'notEquals'
          ? '<>'
          : filter.operator === 'contains'
            ? 'ilike'
            : 'not ilike';
    return `coalesce(${column}, '') ${operator} {{${name}}}`;
  });
  return `and (${clauses.join(match === 'all' ? ' and ' : ' or ')})`;
}

function behaviorSql(behaviors: AnalysisBehavior[], params: Record<string, unknown>) {
  const unique = new Map(
    behaviors.map(behavior => [`${behavior.type}\u0000${behavior.value}`, behavior]),
  );
  return [...unique.values()]
    .map((behavior, index) => {
      const name = `behavior_${index}`;
      params[name] = behavior.value;
      return `${behavior.type === 'event' ? 'we.event_name' : 'we.url_path'} = {{${name}}}`;
    })
    .join(' or ');
}

async function fetchEvents(query: AnalysisQueryV1): Promise<EventRow[]> {
  const behaviors =
    query.mode === 'funnel'
      ? query.funnel?.steps
      : query.mode === 'retention' && query.retention
        ? [query.retention.entry, query.retention.returning]
        : undefined;
  if (!behaviors?.length) {
    throw new AnalysisValidationError(
      'analysis-behavior-required',
      'Advanced analysis requires behaviors.',
    );
  }
  const params: Record<string, unknown> = {
    projectId: query.projectId,
    startAt: new Date(query.range.startAt),
    endAt: new Date(query.range.endAt),
  };
  const selectedBehaviorSql = behaviorSql(behaviors, params);
  const selectedFilterSql = filterSql(query.filters, query.match, params);
  const propertiesSql = behaviors.some(behavior => behavior.filters.length > 0)
    ? `coalesce((
          select jsonb_object_agg(ed.data_key, coalesce(ed.string_value, ed.number_value::text, ed.date_value::text))
          from event_data ed
          where ed.website_id = we.website_id and ed.website_event_id = we.event_id
        ), '{}'::jsonb)`
    : `'{}'::jsonb`;

  return prisma.rawQuery(
    `
      select
        we.event_id::text as "eventId",
        we.session_id::text as "sessionId",
        coalesce(nullif(s.distinct_id, ''), 'session:' || we.session_id::text) as "actorId",
        nullif(s.distinct_id, '') as "distinctId",
        we.created_at as "createdAt",
        we.event_name as "eventName",
        we.url_path as "urlPath",
        s.browser,
        s.os,
        s.device,
        s.country,
        ${propertiesSql} as properties
      from website_event we
      join session s on s.session_id = we.session_id and s.website_id = we.website_id
      where we.website_id = {{projectId::uuid}}
        and we.created_at >= {{startAt}}
        and we.created_at < {{endAt}}
        and (${selectedBehaviorSql})
        ${selectedFilterSql}
      order by "actorId", we.created_at, we.event_id
    `,
    params,
    `analysis_${query.mode}_events`,
  );
}

function matchesValue(actual: string, expected: string, operator: AnalysisFilter['operator']) {
  const left = actual.toLocaleLowerCase();
  const right = expected.toLocaleLowerCase();
  if (operator === 'equals') return actual === expected;
  if (operator === 'notEquals') return actual !== expected;
  if (operator === 'contains') return left.includes(right);
  return !left.includes(right);
}

function matchesBehavior(event: EventRow, behavior: AnalysisBehavior) {
  const value = behavior.type === 'event' ? event.eventName : event.urlPath;
  if (value !== behavior.value) return false;
  const properties = event.properties ?? {};
  return behavior.filters.every(filter =>
    matchesValue(String(properties[filter.property] ?? ''), filter.value, filter.operator),
  );
}

function compareEvents(left: EventRow, right: EventRow) {
  const time = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return time || left.eventId.localeCompare(right.eventId);
}

function groupActors(events: EventRow[]) {
  const groups = new Map<string, EventRow[]>();
  for (const event of events) {
    const group = groups.get(event.actorId) ?? [];
    group.push(event);
    groups.set(event.actorId, group);
  }
  for (const group of groups.values()) group.sort(compareEvents);
  return groups;
}

function buildJourneys(events: EventRow[], query: AnalysisQueryV1): ActorJourney[] {
  const funnel = query.funnel;
  if (!funnel) return [];
  const windowMs = funnel.conversionWindowMinutes * 60_000;
  const journeys: ActorJourney[] = [];
  for (const [actorId, actorEvents] of groupActors(events)) {
    const first = actorEvents.find(event => matchesBehavior(event, funnel.steps[0]));
    if (!first) continue;
    const reached = [first];
    for (const behavior of funnel.steps.slice(1)) {
      const previous = reached.at(-1) as EventRow;
      const next = actorEvents.find(
        event =>
          compareEvents(event, previous) > 0 &&
          new Date(event.createdAt).getTime() - new Date(first.createdAt).getTime() <= windowMs &&
          matchesBehavior(event, behavior),
      );
      if (!next) break;
      reached.push(next);
    }
    journeys.push({ actorId, events: actorEvents, reached });
  }
  return journeys;
}

function localParts(value: Date | string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

function periodIdentity(
  value: Date | string,
  timezone: string,
  unit: 'hour' | 'day' | 'week' | 'month',
) {
  const part = localParts(value, timezone);
  if (unit === 'month')
    return {
      key: `${part.year}-${String(part.month).padStart(2, '0')}`,
      ordinal: part.year * 12 + part.month,
    };
  const dayOrdinal = Math.floor(Date.UTC(part.year, part.month - 1, part.day) / 86_400_000);
  if (unit === 'week') {
    const weekday = new Date(Date.UTC(part.year, part.month - 1, part.day)).getUTCDay() || 7;
    const monday = dayOrdinal - weekday + 1;
    const date = new Date(monday * 86_400_000).toISOString().slice(0, 10);
    return { key: date, ordinal: Math.floor(monday / 7) };
  }
  const day = `${part.year}-${String(part.month).padStart(2, '0')}-${String(part.day).padStart(2, '0')}`;
  return unit === 'hour'
    ? {
        key: `${day} ${String(part.hour).padStart(2, '0')}:00`,
        ordinal: dayOrdinal * 24 + part.hour,
      }
    : { key: day, ordinal: dayOrdinal };
}

function funnelRows(events: EventRow[], query: AnalysisQueryV1) {
  const funnel = query.funnel as NonNullable<AnalysisQueryV1['funnel']>;
  const journeys = buildJourneys(events, query);
  const groups = new Map<string, ActorJourney[]>();
  if (query.breakdown) {
    for (const journey of journeys) {
      const value = String(
        journey.reached[0][query.breakdown.field as keyof EventRow] ?? '(not set)',
      );
      const group = groups.get(value) ?? [];
      group.push(journey);
      groups.set(value, group);
    }
  } else {
    groups.set('', journeys);
  }
  const selectedGroups = [...groups.entries()]
    .toSorted((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .slice(0, query.breakdown?.limit ?? 1);
  const steps: AnalysisFunnelStepRow[] = [];
  for (const [segment, group] of selectedGroups) {
    const entrants = group.length;
    funnel.steps.forEach((behavior, index) => {
      const converted = group.filter(journey => journey.reached.length > index).length;
      const previous =
        index === 0 ? entrants : group.filter(journey => journey.reached.length >= index).length;
      steps.push({
        kind: 'funnel-step',
        value: converted,
        step: index + 1,
        label: behavior.value,
        entrants,
        converted,
        dropped: Math.max(0, previous - converted),
        stepConversionRate: previous ? converted / previous : 0,
        overallConversionRate: entrants ? converted / entrants : 0,
        ...(segment ? { segment } : {}),
      });
    });
  }
  const trendMap = new Map<string, { entrants: number; converted: number }>();
  for (const journey of journeys) {
    const bucket = periodIdentity(
      journey.reached[0].createdAt,
      query.range.timezone,
      query.range.unit,
    ).key;
    const value = trendMap.get(bucket) ?? { entrants: 0, converted: 0 };
    value.entrants += 1;
    if (journey.reached.length === funnel.steps.length) value.converted += 1;
    trendMap.set(bucket, value);
  }
  const trend: AnalysisFunnelTrendRow[] = [...trendMap.entries()].map(([bucket, value]) => ({
    kind: 'funnel-trend',
    value: value.converted,
    bucket,
    ...value,
    conversionRate: value.entrants ? value.converted / value.entrants : 0,
  }));
  const durationCounts = [0, 0, 0, 0, 0];
  for (const journey of journeys.filter(item => item.reached.length === funnel.steps.length)) {
    const last = journey.reached.at(-1);
    if (!last) continue;
    const duration =
      (new Date(last.createdAt).getTime() - new Date(journey.reached[0].createdAt).getTime()) /
      60_000;
    durationCounts[
      duration < 1 ? 0 : duration < 5 ? 1 : duration < 15 ? 2 : duration < 60 ? 3 : 4
    ] += 1;
  }
  const duration: AnalysisFunnelDurationRow[] = ['<1m', '1–5m', '5–15m', '15–60m', '60m+'].map(
    (bucket, index) => ({
      kind: 'funnel-duration',
      value: durationCounts[index],
      bucket,
      converted: durationCounts[index],
    }),
  );
  return { rows: [...steps, ...trend, ...duration] satisfies AnalysisRows, journeys };
}

function retentionRows(events: EventRow[], query: AnalysisQueryV1) {
  const retention = query.retention as NonNullable<AnalysisQueryV1['retention']>;
  const actors = groupActors(events);
  const cohorts = new Map<
    string,
    { ordinal: number; entrants: Set<string>; returns: Map<number, Set<string>> }
  >();
  for (const [actorId, actorEvents] of actors) {
    const entry = actorEvents.find(event => matchesBehavior(event, retention.entry));
    if (!entry) continue;
    const identity = periodIdentity(entry.createdAt, query.range.timezone, retention.granularity);
    const cohort = cohorts.get(identity.key) ?? {
      ordinal: identity.ordinal,
      entrants: new Set(),
      returns: new Map(),
    };
    cohort.entrants.add(actorId);
    for (const event of actorEvents) {
      if (compareEvents(event, entry) <= 0 || !matchesBehavior(event, retention.returning))
        continue;
      const period =
        periodIdentity(event.createdAt, query.range.timezone, retention.granularity).ordinal -
        identity.ordinal;
      if (period < 0 || period > retention.periods) continue;
      const members = cohort.returns.get(period) ?? new Set<string>();
      members.add(actorId);
      cohort.returns.set(period, members);
    }
    cohorts.set(identity.key, cohort);
  }
  const rows: AnalysisRetentionRow[] = [];
  for (const [cohortStart, cohort] of [...cohorts.entries()].toSorted(
    (left, right) => left[1].ordinal - right[1].ordinal,
  )) {
    const cohortSize = cohort.entrants.size;
    for (let period = 0; period <= retention.periods; period += 1) {
      const retained = period === 0 ? cohortSize : (cohort.returns.get(period)?.size ?? 0);
      rows.push({
        kind: 'retention-cell',
        value: retained,
        cohortStart,
        period,
        cohortSize,
        retained,
        retentionRate: cohortSize ? retained / cohortSize : 0,
      });
    }
  }
  return { rows, actors, cohorts };
}

export async function executeAdvancedPostgresql(query: AnalysisQueryV1): Promise<AnalysisRows> {
  const events = await fetchEvents(query);
  return query.mode === 'funnel'
    ? funnelRows(events, query).rows
    : retentionRows(events, query).rows;
}

async function enrichMembers(
  projectId: string,
  actorIds: string[],
  events: EventRow[],
): Promise<AnalysisMember[]> {
  const distinctIds = actorIds.filter(id => !id.startsWith('session:'));
  const identityParams: Record<string, unknown> = { projectId };
  const identityRefs = distinctIds.map((value, index) => {
    const key = `member_${index}`;
    identityParams[key] = value;
    return `{{${key}}}`;
  });
  const identities: Array<{
    actorId: string;
    trackedUserId: string | null;
    userExternalId: string | null;
    displayName: string | null;
    trackedAccountId: string | null;
    accountExternalId: string | null;
    accountName: string | null;
  }> = distinctIds.length
    ? await prisma.rawQuery(
        `select tu.external_id as "actorId", tu.tracked_user_id::text as "trackedUserId",
          tu.external_id as "userExternalId", tu.display_name as "displayName",
          ta.tracked_account_id::text as "trackedAccountId", ta.external_id as "accountExternalId", ta.name as "accountName"
         from tracked_user tu
         left join account_membership am on am.tracked_user_id = tu.tracked_user_id and am.project_id = tu.project_id
         left join tracked_account ta on ta.tracked_account_id = am.tracked_account_id and ta.project_id = tu.project_id
         where tu.project_id = {{projectId::uuid}} and tu.external_id in (${identityRefs.join(', ')})`,
        identityParams,
        'analysis_member_identity',
      )
    : [];
  const byActor = new Map(identities.map(identity => [identity.actorId, identity]));
  return actorIds.slice(0, 20).map(actorId => {
    const identity = byActor.get(actorId);
    return {
      actorId,
      trackedUser: identity?.trackedUserId
        ? {
            id: identity.trackedUserId,
            externalId: identity.userExternalId as string,
            displayName: identity.displayName,
          }
        : null,
      account: identity?.trackedAccountId
        ? {
            id: identity.trackedAccountId,
            externalId: identity.accountExternalId as string,
            name: identity.accountName,
          }
        : null,
      sessionIds: [
        ...new Set(events.filter(event => event.actorId === actorId).map(event => event.sessionId)),
      ].slice(0, 20),
    };
  });
}

export async function getAdvancedAnalysisMembers(
  query: AnalysisQueryV1,
  selection: AnalysisMemberSelection,
) {
  const events = await fetchEvents(query);
  let actorIds: string[] = [];
  if (selection.kind === 'funnel-step' && query.mode === 'funnel') {
    const journeys = buildJourneys(events, query);
    actorIds = journeys
      .filter(journey =>
        selection.outcome === 'reached'
          ? journey.reached.length >= selection.step
          : journey.reached.length === selection.step - 1,
      )
      .map(journey => journey.actorId);
  } else if (selection.kind === 'retention-cell' && query.mode === 'retention') {
    const retention = retentionRows(events, query);
    const cohort = retention.cohorts.get(selection.cohortStart);
    actorIds = cohort
      ? [
          ...(selection.period === 0
            ? cohort.entrants
            : (cohort.returns.get(selection.period) ?? [])),
        ]
      : [];
  } else {
    throw new AnalysisValidationError(
      'analysis-member-selection-invalid',
      'Drill-down selection does not match analysis mode.',
    );
  }
  return {
    total: actorIds.length,
    limit: 20,
    members: await enrichMembers(query.projectId, actorIds, events),
  };
}
