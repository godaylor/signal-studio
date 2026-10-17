import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';

const DAY = 86_400_000;
export const GUEST_DATASET = Object.freeze({
  version: 'signal-studio.synthetic.v1',
  synthetic: true,
  days: 42,
  users: 336,
  accounts: 84,
  sessions: 441,
  events: 1281,
  customEvents: 945,
  signups: 336,
  onboarding: 252,
  activatedUsers: 168,
  subscriptions: 84,
  coreFeatureEvents: 273,
});

export function guestDatasetRange(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start: new Date(end.getTime() - 42 * DAY), end };
}

export function guestExampleQuery(projectId: string, start: Date, end: Date): AnalysisQueryV1 {
  return normalizeAnalysisQuery({
    version: 1,
    projectId,
    mode: 'funnel',
    range: { startAt: start.toISOString(), endAt: end.toISOString(), timezone: 'UTC', unit: 'day' },
    measure: { source: 'event', key: '*', aggregation: 'count' },
    filters: [],
    match: 'all',
    comparison: 'none',
    visualization: 'bar',
    funnel: {
      conversionWindowMinutes: 1440,
      steps: ['signup', 'onboarding_completed', 'core_feature_used'].map(value => ({
        type: 'event',
        value,
        filters: [],
      })),
    },
  });
}

/** First-party deterministic fictional fixture. All displayed aggregates use normal analytics SQL.
 * 42 UTC days, half-open [start,end). Application users are separate from tracked synthetic users.
 * Per day 8 signups,6 onboard,4 activate,2 subscribe. Desktop activation 75%, mobile 25%.
 * Three of the first 35 daily cohorts return seven days later. No late arrivals or real PII.
 */
export async function seedGuestDataset(
  tx: Prisma.TransactionClient,
  projectId: string,
  ownerId: string,
  start: Date,
  end: Date,
) {
  const sessions: Prisma.SessionCreateManyInput[] = [];
  const events: Prisma.WebsiteEventCreateManyInput[] = [];
  const users: Prisma.TrackedUserCreateManyInput[] = [];
  const accounts: Prisma.TrackedAccountCreateManyInput[] = [];
  const memberships: Prisma.AccountMembershipCreateManyInput[] = [];
  const revenue: Prisma.RevenueCreateManyInput[] = [];
  for (let day = 0; day < 42; day++) {
    for (let group = 0; group < 2; group++) {
      const id = randomUUID();
      const accountIndex = accounts.length;
      const accountFirstSeen = new Date(
        start.getTime() + day * DAY + (9 * 60 + group * 20) * 60_000,
      );
      accounts.push({
        id,
        projectId,
        externalId: `synthetic-company-${day * 2 + group + 1}`,
        name: `Example team ${day * 2 + group + 1}`,
        traits: { synthetic: true, plan: group ? 'starter' : 'growth' },
        lifecycleStage: day < 35 ? 'retained' : 'activated',
        firstSeenAt: accountFirstSeen,
        activatedAt: new Date(accountFirstSeen.getTime() + 20 * 60_000),
        lastSeenAt: accountFirstSeen,
      });
      for (let person = 0; person < 4; person++) {
        const local = group * 4 + person;
        const number = day * 8 + local + 1;
        const distinctId = `synthetic-person-${number}`;
        const createdAt = new Date(start.getTime() + day * DAY + (9 * 60 + local * 5) * 60_000);
        const activated = [0, 1, 2, 4].includes(local);
        const onboarded = local !== 3 && local !== 7;
        const returned = day < 35 && [0, 1, 4].includes(local);
        const lastSeenAt = new Date(
          createdAt.getTime() +
            (returned
              ? 7 * DAY + 30 * 60_000
              : ([0, 4].includes(local) ? 30 : activated ? 20 : onboarded ? 10 : 1) * 60_000),
        );
        if (lastSeenAt.getTime() > (accounts[accountIndex].lastSeenAt as Date).getTime())
          accounts[accountIndex].lastSeenAt = lastSeenAt;
        const userId = randomUUID();
        users.push({
          id: userId,
          projectId,
          externalId: distinctId,
          displayName: `Example person ${number}`,
          traits: {
            synthetic: true,
            device: group ? 'mobile' : 'desktop',
            plan: group ? 'starter' : 'growth',
          },
          lifecycleStage: returned
            ? 'retained'
            : activated
              ? 'activated'
              : onboarded
                ? 'onboarding'
                : 'signed-up',
          activatedAt: activated ? new Date(createdAt.getTime() + 20 * 60_000) : null,
          firstSeenAt: createdAt,
          lastSeenAt,
        });
        memberships.push({
          id: randomUUID(),
          projectId,
          trackedUserId: userId,
          trackedAccountId: id,
          observedAt: createdAt,
        });
        const addSession = (at: Date) => {
          const sessionId = randomUUID();
          sessions.push({
            id: sessionId,
            websiteId: projectId,
            distinctId,
            createdAt: at,
            device: group ? 'mobile' : 'desktop',
            browser: group ? 'safari' : 'chrome',
            os: group ? 'iOS' : 'Windows 11',
            country: ['US', 'DE', 'GB'][day % 3],
          });
          return sessionId;
        };
        const sessionId = addSession(createdAt);
        const visitId = randomUUID();
        const addEvent = (
          eventName: string | null,
          minutes: number,
          sid = sessionId,
          at = createdAt,
          vid = visitId,
        ) => {
          const event = {
            id: randomUUID(),
            websiteId: projectId,
            sessionId: sid,
            visitId: vid,
            createdAt: new Date(at.getTime() + minutes * 60_000),
            eventType: eventName ? 2 : 1,
            eventName,
            urlPath: eventName === 'signup' ? '/signup' : '/workspace',
            hostname: 'synthetic.example',
            tag: 'synthetic',
          };
          events.push(event);
          return event;
        };
        addEvent(null, 0);
        addEvent('signup', 1);
        if (onboarded) addEvent('onboarding_completed', 10);
        if (activated) addEvent('core_feature_used', 20);
        if ([0, 4].includes(local)) {
          const purchase = addEvent('subscription_started', 30);
          revenue.push({
            id: randomUUID(),
            websiteId: projectId,
            sessionId,
            eventId: purchase.id,
            eventName: 'subscription_started',
            currency: 'USD',
            revenue: group ? 29 : 99,
            createdAt: purchase.createdAt,
          });
        }
        if (returned) {
          const at = new Date(createdAt.getTime() + 7 * DAY + 30 * 60_000);
          addEvent('core_feature_used', 0, addSession(at), at, randomUUID());
        }
      }
    }
  }
  await tx.trackedAccount.createMany({ data: accounts });
  await tx.trackedUser.createMany({ data: users });
  await tx.accountMembership.createMany({ data: memberships });
  await tx.session.createMany({ data: sessions });
  await tx.websiteEvent.createMany({ data: events });
  await tx.revenue.createMany({ data: revenue });
  const query = guestExampleQuery(projectId, start, end);
  const trend = normalizeAnalysisQuery({
    ...query,
    mode: 'trend',
    funnel: undefined,
    visualization: 'line',
    measure: { source: 'event', key: 'core_feature_used', aggregation: 'count' },
  });
  const breakdown = normalizeAnalysisQuery({ ...query, breakdown: { field: 'device', limit: 5 } });
  const insightIds = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, item] of [
    { title: 'Где теряется активация?', query },
    { title: 'Как часто используют ключевую функцию?', query: trend },
    { title: 'Почему мобильные пользователи активируются реже?', query: breakdown },
  ].entries()) {
    await tx.insight.create({
      data: {
        id: insightIds[index],
        projectId,
        ownerId,
        title: item.title,
        description: 'Синтетические события. Измените параметры и рассчитайте результат заново.',
        queryVersion: 1,
        query: item.query,
        visualization: { type: item.query.visualization },
        favorite: true,
      },
    });
  }
  const dashboardId = randomUUID();
  await tx.studioDashboard.create({
    data: {
      id: dashboardId,
      projectId,
      ownerId,
      title: 'Активация продукта',
      description: 'Рабочий пример на синтетических событиях',
      sharePolicy: { mode: 'private', version: 1 },
    },
  });
  await tx.studioDashboardWidget.createMany({
    data: insightIds.map((insightId, index) => ({
      id: randomUUID(),
      dashboardId,
      insightId,
      kind: 'insight',
      position: index,
      width: index === 0 ? 2 : 1,
      height: 1,
    })),
  });
  return { query, insightIds, dashboardId };
}
