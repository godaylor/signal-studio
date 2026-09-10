import { differenceInCalendarDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { isWithinDateRange } from '@/lib/date';

export const GOLDEN_TIMEZONE = 'America/New_York';
export const GOLDEN_RANGE = {
  startDate: new Date('2026-03-07T05:00:00.000Z'),
  endDate: new Date('2026-03-11T04:00:00.000Z'),
};

const exactRange = {
  boundary: '[start, end)',
  timezone: GOLDEN_TIMEZONE,
  exactness: 'exact',
} as const;

export const GOLDEN_DEFINITIONS = {
  identities: {
    visitor: {
      unit: 'distinct visitorId',
      productionSemantics:
        'Persisted as session.distinctId in the PostgreSQL fixture; this is not getWebsiteStats.visitors.',
      ...exactRange,
    },
    user: {
      unit: 'distinct non-null product userId',
      productionSemantics:
        'Persisted as session_data.user_id because the legacy schema has no TrackedUser table.',
      ...exactRange,
    },
    account: {
      unit: 'distinct non-null accountId',
      productionSemantics:
        'Persisted as session_data.account_id because the legacy schema has no TrackedAccount table.',
      ...exactRange,
    },
    session: {
      unit: 'distinct sessionId',
      productionSemantics:
        'Persisted as one session row; a visitor and user can own multiple sessions.',
      ...exactRange,
    },
    event: {
      unit: 'one immutable event record',
      productionSemantics: 'Persisted as one website_event row whose created_at is in the range.',
      ...exactRange,
    },
  },
  productIntent: {
    activation: {
      unit: 'distinct identified product userId',
      numerator: 'users completing signup, onboarding_completed, core_feature_used in order',
      denominator: 'identified users reaching signup',
      productionSemantics:
        'Pure M2 product-intent oracle only; no M4 identity schema or endpoint exists.',
      ...exactRange,
    },
    funnel: {
      unit: 'distinct identified product userId per ordered step',
      productionSemantics:
        'Pure product-intent oracle across all sessions for a user; intentionally differs from legacy getFunnel.',
      ...exactRange,
    },
    retention: {
      unit: 'distinct activated product userId',
      numerator: 'activated users with core_feature_used on a later local calendar day',
      denominator: 'activated users',
      productionSemantics:
        'Pure product-intent oracle; intentionally differs from generic legacy getRetention.',
      inclusion: 'Bob is eligible but not activated; anonymous sessions are excluded.',
      ...exactRange,
    },
  },
  legacyProduction: {
    pageviews: {
      unit: 'website_event rows with a page-view event type',
      productionSemantics: 'getWebsiteStats.pageviews sums page-view rows after filters.',
      ...exactRange,
    },
    visitors: {
      unit: 'distinct sessionId',
      productionSemantics:
        'getWebsiteStats.visitors is a legacy field name and counts distinct sessions, not visitorId or userId.',
      ...exactRange,
    },
    visits: {
      unit: 'distinct visitId',
      productionSemantics: 'getWebsiteStats.visits counts distinct visit_id values.',
      ...exactRange,
    },
    bounces: {
      unit: 'stable (sessionId, visitId) visit tuple',
      numerator: 'single-page visits without a custom event',
      denominator: 'not returned by getWebsiteStats',
      productionSemantics: 'getWebsiteStats.bounces returns the numerator count.',
      ...exactRange,
    },
    totalTime: {
      unit: 'seconds summed across visitId page-view spans',
      productionSemantics:
        'getWebsiteStats.totaltime sums max(page-view time) - min(page-view time) per visit.',
      ...exactRange,
    },
    funnel: {
      unit: 'distinct sessionId per ordered step',
      productionSemantics:
        'getFunnel follows ordered events inside a session; the same product user can count in multiple sessions.',
      inclusion:
        'Anonymous sessions can count when they emit matching events; this fixture anonymous session does not.',
      ...exactRange,
    },
    retention: {
      unit: 'distinct sessionId in a first-touch local-day cohort',
      numerator: 'cohort sessions active on the requested local-day offset',
      denominator: 'all sessions first seen on the cohort day',
      productionSemantics:
        'getRetention is generic session first-touch retention, not activated-user retention.',
      inclusion:
        'All sessions are included: incomplete Bob and the anonymous session intentionally contribute day-zero cohorts.',
      ...exactRange,
    },
  },
} as const;

export type GoldenAccount = { id: string; plan: 'enterprise' | 'self-serve' };
export type GoldenUser = { id: string; accountId: string };
export type GoldenSession = {
  id: string;
  visitorId: string;
  userId?: string;
  accountId?: string;
};
export type GoldenEvent = {
  id: string;
  visitorId: string;
  userId?: string;
  accountId?: string;
  sessionId: string;
  visitId: string;
  name: 'page_view' | 'signup' | 'onboarding_completed' | 'core_feature_used';
  occurredAt: Date;
};

const event = (
  id: string,
  session: GoldenSession,
  visitId: string,
  name: GoldenEvent['name'],
  occurredAt: string,
): GoldenEvent => ({
  id,
  sessionId: session.id,
  visitId,
  visitorId: session.visitorId,
  userId: session.userId,
  accountId: session.accountId,
  name,
  occurredAt: new Date(occurredAt),
});

const sessions: GoldenSession[] = [
  {
    id: 'session-alice-onboarding',
    visitorId: 'visitor-alice',
    userId: 'user-alice',
    accountId: 'acme',
  },
  {
    id: 'session-alice-return',
    visitorId: 'visitor-alice',
    userId: 'user-alice',
    accountId: 'acme',
  },
  { id: 'session-bob', visitorId: 'visitor-bob', userId: 'user-bob', accountId: 'acme' },
  { id: 'session-cara', visitorId: 'visitor-cara', userId: 'user-cara', accountId: 'beta' },
  { id: 'session-anon', visitorId: 'visitor-anon' },
  { id: 'session-boundary', visitorId: 'visitor-boundary', userId: 'user-boundary' },
];

export const GOLDEN_DATASET = {
  accounts: [
    { id: 'acme', plan: 'enterprise' },
    { id: 'beta', plan: 'self-serve' },
  ] satisfies GoldenAccount[],
  users: [
    { id: 'user-alice', accountId: 'acme' },
    { id: 'user-bob', accountId: 'acme' },
    { id: 'user-cara', accountId: 'beta' },
  ] satisfies GoldenUser[],
  sessions,
  events: [
    event('e01', sessions[0], 'visit-alice-onboarding', 'page_view', '2026-03-07T15:00:00.000Z'),
    event('e02', sessions[0], 'visit-alice-onboarding', 'signup', '2026-03-07T15:01:00.000Z'),
    event(
      'e03',
      sessions[0],
      'visit-alice-onboarding',
      'onboarding_completed',
      '2026-03-07T15:05:00.000Z',
    ),
    event(
      'e04',
      sessions[0],
      'visit-alice-onboarding',
      'core_feature_used',
      '2026-03-07T15:10:00.000Z',
    ),
    event('e05', sessions[1], 'visit-alice-return', 'page_view', '2026-03-08T07:30:00.000Z'),
    event('e06', sessions[1], 'visit-alice-return', 'signup', '2026-03-08T07:31:00.000Z'),
    event(
      'e07',
      sessions[1],
      'visit-alice-return',
      'onboarding_completed',
      '2026-03-08T07:32:00.000Z',
    ),
    event(
      'e08',
      sessions[1],
      'visit-alice-return',
      'core_feature_used',
      '2026-03-08T07:33:00.000Z',
    ),
    event('e09', sessions[2], 'visit-bob', 'page_view', '2026-03-07T16:00:00.000Z'),
    event('e10', sessions[2], 'visit-bob', 'signup', '2026-03-07T16:01:00.000Z'),
    event('e11', sessions[2], 'visit-bob', 'onboarding_completed', '2026-03-07T16:05:00.000Z'),
    event('e12', sessions[3], 'visit-cara', 'page_view', '2026-03-09T14:00:00.000Z'),
    event('e13', sessions[3], 'visit-cara', 'signup', '2026-03-09T14:01:00.000Z'),
    event('e14', sessions[3], 'visit-cara', 'onboarding_completed', '2026-03-09T14:05:00.000Z'),
    event('e15', sessions[3], 'visit-cara', 'core_feature_used', '2026-03-09T14:10:00.000Z'),
    event('e16', sessions[4], 'visit-anon', 'page_view', '2026-03-10T12:00:00.000Z'),
    event('e17', sessions[0], 'visit-alice-bounce', 'page_view', '2026-03-07T15:30:00.000Z'),
    event(
      'boundary-funnel-step',
      sessions[5],
      'visit-boundary',
      'signup',
      GOLDEN_RANGE.endDate.toISOString(),
    ),
  ] satisfies GoldenEvent[],
} as const;

const activationSteps: GoldenEvent['name'][] = [
  'signup',
  'onboarding_completed',
  'core_feature_used',
];

function localDay(date: Date, timezone: string) {
  return format(toZonedTime(date, timezone), 'yyyy-MM-dd');
}

function orderedStepCount(eventsByIdentity: Map<string, GoldenEvent[]>) {
  return activationSteps.map((step, stepIndex) => ({
    step,
    identities: [...eventsByIdentity.values()].filter(identityEvents => {
      let cursor = -1;

      for (const requiredStep of activationSteps.slice(0, stepIndex + 1)) {
        cursor = identityEvents.findIndex(
          (item, index) => index > cursor && item.name === requiredStep,
        );
        if (cursor < 0) return false;
      }

      return true;
    }).length,
  }));
}

function selectedEvents(range: typeof GOLDEN_RANGE, sourceEvents: readonly GoldenEvent[]) {
  return sourceEvents
    .filter(item => isWithinDateRange(item.occurredAt, range.startDate, range.endDate))
    .toSorted((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

export function summarizeProductIntent(
  range = GOLDEN_RANGE,
  timezone = GOLDEN_TIMEZONE,
  sourceEvents: readonly GoldenEvent[] = GOLDEN_DATASET.events,
) {
  const events = selectedEvents(range, sourceEvents);
  const identifiedEvents = events.filter(item => item.userId);
  const eventsByUser = Map.groupBy(identifiedEvents, item => item.userId as string);
  const funnel = orderedStepCount(eventsByUser).map(item => ({
    step: item.step,
    users: item.identities,
  }));
  const activatedUsers = new Set(
    [...eventsByUser.entries()]
      .filter(
        ([, userEvents]) => orderedStepCount(new Map([['user', userEvents]]))[2].identities > 0,
      )
      .map(([userId]) => userId),
  );
  const retainedUsers = [...activatedUsers].filter(userId => {
    const userEvents = eventsByUser.get(userId) ?? [];
    let cursor = -1;

    for (const step of activationSteps) {
      cursor = userEvents.findIndex((item, index) => index > cursor && item.name === step);
    }

    const activationDay = localDay(userEvents[cursor].occurredAt, timezone);
    return userEvents.some(
      (item, index) =>
        index > cursor &&
        item.name === 'core_feature_used' &&
        localDay(item.occurredAt, timezone) > activationDay,
    );
  });

  return {
    timezone,
    range: {
      start: range.startDate.toISOString(),
      endExclusive: range.endDate.toISOString(),
    },
    identities: {
      visitors: new Set(events.map(item => item.visitorId)).size,
      users: new Set(identifiedEvents.map(item => item.userId)).size,
      accounts: new Set(identifiedEvents.flatMap(item => (item.accountId ? [item.accountId] : [])))
        .size,
      sessions: new Set(events.map(item => item.sessionId)).size,
      events: events.length,
    },
    activation: {
      eligibleUsers: funnel[0].users,
      activatedUsers: activatedUsers.size,
      rate: activatedUsers.size / funnel[0].users,
    },
    funnel,
    retention: {
      activatedUsers: activatedUsers.size,
      dayOneUsers: retainedUsers.length,
      dayOneRate: retainedUsers.length / activatedUsers.size,
    },
  };
}

export function summarizeLegacyProduction(range = GOLDEN_RANGE, timezone = GOLDEN_TIMEZONE) {
  const events = selectedEvents(range, GOLDEN_DATASET.events);
  const eventsBySession = Map.groupBy(events, item => item.sessionId);
  const eventsByVisit = Map.groupBy(events, item => `${item.sessionId}\u0000${item.visitId}`);
  const funnel = orderedStepCount(eventsBySession).map(item => ({
    step: item.step,
    sessions: item.identities,
  }));
  const cohortMap = new Map<string, Map<number, Set<string>>>();

  for (const [sessionId, sessionEvents] of eventsBySession) {
    const ordered = sessionEvents.toSorted(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );
    const cohortDate = toZonedTime(ordered[0].occurredAt, timezone);

    for (const day of new Set(ordered.map(item => localDay(item.occurredAt, timezone)))) {
      const offset = differenceInCalendarDays(new Date(`${day}T00:00:00`), cohortDate);
      const byOffset = cohortMap.get(localDay(ordered[0].occurredAt, timezone)) ?? new Map();
      const sessionsAtOffset = byOffset.get(offset) ?? new Set<string>();
      sessionsAtOffset.add(sessionId);
      byOffset.set(offset, sessionsAtOffset);
      cohortMap.set(localDay(ordered[0].occurredAt, timezone), byOffset);
    }
  }

  const retention = [...cohortMap.entries()].flatMap(([cohort, byOffset]) => {
    const cohortSessions = byOffset.get(0)?.size ?? 0;
    return [...byOffset.entries()].map(([day, sessionIds]) => ({
      cohort,
      day,
      sessions: cohortSessions,
      returnSessions: sessionIds.size,
      percentage: (sessionIds.size / cohortSessions) * 100,
    }));
  });

  return {
    websiteStats: {
      pageviews: events.filter(item => item.name === 'page_view').length,
      visitorsFieldSessions: eventsBySession.size,
      visits: new Set(events.map(item => item.visitId)).size,
      bounces: [...eventsByVisit.values()].filter(
        visitEvents =>
          visitEvents.filter(item => item.name === 'page_view').length === 1 &&
          visitEvents.every(item => item.name === 'page_view'),
      ).length,
      totalTimeSeconds: 0,
    },
    funnel,
    retention,
  };
}
