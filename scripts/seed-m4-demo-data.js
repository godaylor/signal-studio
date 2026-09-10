export const M4_DEMO_ANCHOR = new Date('2026-03-01T09:00:00.000Z');

export const M4_DEMO_IDS = Object.freeze({
  enterpriseAccount: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a101',
  selfServeAccount: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a102',
  alice: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a111',
  bob: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a112',
  cara: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a113',
  aliceMembership: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a121',
  bobMembership: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a122',
  caraMembership: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a123',
  aliceSession1: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a131',
  aliceSession2: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a132',
  bobSession: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a133',
  caraSession: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a134',
  aliceVisit1: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a141',
  aliceVisit2: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a142',
  bobVisit: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a143',
  caraVisit: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a144',
  aliceSignup: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a151',
  aliceOnboarding: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a152',
  aliceActivation: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a153',
  aliceReturn: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a154',
  alicePurchase: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a155',
  bobSignup: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a156',
  bobOnboarding: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a157',
  caraSignup: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a158',
  enterpriseRevenue: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a161',
});

/** @typedef {Record<keyof typeof M4_DEMO_IDS, string>} M4DemoIds */

const at = iso => new Date(iso);

/**
 * @param {any} prisma
 * @param {{ projectId: string, ids?: M4DemoIds }} options
 */
export async function seedM4Demo(prisma, { projectId, ids = M4_DEMO_IDS }) {
  const M4_DEMO_IDS = ids;

  const project = await prisma.website.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Signal Studio demo Project ${projectId} is missing.`);
  }

  await prisma.trackedAccount.createMany({
    skipDuplicates: true,
    data: [
      {
        id: M4_DEMO_IDS.enterpriseAccount,
        projectId,
        externalId: 'acme-enterprise',
        name: 'Acme Cloud',
        traits: { plan: 'enterprise', industry: 'software', company_size: '201-500' },
        sensitiveTraits: { billing_email: 'billing@acme.demo' },
        lifecycleStage: 'retained',
        definitionVersion: 'signal-studio.activation.v1',
        activatedAt: at('2026-03-01T09:45:00.000Z'),
        firstSeenAt: M4_DEMO_ANCHOR,
        lastSeenAt: at('2026-03-08T10:05:00.000Z'),
      },
      {
        id: M4_DEMO_IDS.selfServeAccount,
        projectId,
        externalId: 'beta-self-serve',
        name: 'Beta Works',
        traits: { plan: 'starter', industry: 'consulting', company_size: '1-10' },
        sensitiveTraits: { billing_email: 'owner@beta.demo' },
        lifecycleStage: 'onboarding',
        definitionVersion: 'signal-studio.activation.v1',
        activatedAt: null,
        firstSeenAt: at('2026-03-02T11:00:00.000Z'),
        lastSeenAt: at('2026-03-04T08:00:00.000Z'),
      },
    ],
  });

  await prisma.trackedUser.createMany({
    skipDuplicates: true,
    data: [
      {
        id: M4_DEMO_IDS.alice,
        projectId,
        externalId: 'user-alice',
        displayName: 'Alice Morgan',
        traits: { plan: 'enterprise', role: 'product-lead', lifecycle_stage: 'retained' },
        sensitiveTraits: { email: 'alice@acme.demo' },
        lifecycleStage: 'retained',
        definitionVersion: 'signal-studio.activation.v1',
        activatedAt: at('2026-03-01T09:45:00.000Z'),
        firstSeenAt: M4_DEMO_ANCHOR,
        lastSeenAt: at('2026-03-08T10:05:00.000Z'),
      },
      {
        id: M4_DEMO_IDS.bob,
        projectId,
        externalId: 'user-bob',
        displayName: 'Bob Chen',
        traits: { plan: 'enterprise', role: 'engineer', lifecycle_stage: 'onboarding' },
        sensitiveTraits: { email: 'bob@acme.demo' },
        lifecycleStage: 'onboarding',
        definitionVersion: 'signal-studio.activation.v1',
        activatedAt: null,
        firstSeenAt: at('2026-03-02T11:00:00.000Z'),
        lastSeenAt: at('2026-03-02T11:20:00.000Z'),
      },
      {
        id: M4_DEMO_IDS.cara,
        projectId,
        externalId: 'user-cara',
        displayName: 'Cara Diaz',
        traits: { plan: 'starter', role: 'founder', lifecycle_stage: 'inactive' },
        sensitiveTraits: { email: 'cara@beta.demo' },
        lifecycleStage: 'inactive',
        definitionVersion: 'signal-studio.activation.v1',
        activatedAt: null,
        firstSeenAt: at('2026-03-03T08:00:00.000Z'),
        lastSeenAt: at('2026-03-04T08:00:00.000Z'),
      },
    ],
  });

  await prisma.accountMembership.createMany({
    skipDuplicates: true,
    data: [
      {
        id: M4_DEMO_IDS.aliceMembership,
        projectId,
        trackedUserId: M4_DEMO_IDS.alice,
        trackedAccountId: M4_DEMO_IDS.enterpriseAccount,
        observedAt: at('2026-03-08T10:05:00.000Z'),
      },
      {
        id: M4_DEMO_IDS.bobMembership,
        projectId,
        trackedUserId: M4_DEMO_IDS.bob,
        trackedAccountId: M4_DEMO_IDS.enterpriseAccount,
        observedAt: at('2026-03-02T11:20:00.000Z'),
      },
      {
        id: M4_DEMO_IDS.caraMembership,
        projectId,
        trackedUserId: M4_DEMO_IDS.cara,
        trackedAccountId: M4_DEMO_IDS.enterpriseAccount,
        observedAt: at('2026-03-04T08:00:00.000Z'),
      },
    ],
  });

  await prisma.session.createMany({
    skipDuplicates: true,
    data: [
      {
        id: M4_DEMO_IDS.aliceSession1,
        websiteId: projectId,
        distinctId: 'user-alice',
        browser: 'chrome',
        os: 'Mac OS',
        device: 'laptop',
        country: 'US',
        createdAt: M4_DEMO_ANCHOR,
      },
      {
        id: M4_DEMO_IDS.aliceSession2,
        websiteId: projectId,
        distinctId: 'user-alice',
        browser: 'chrome',
        os: 'Mac OS',
        device: 'laptop',
        country: 'US',
        createdAt: at('2026-03-08T10:00:00.000Z'),
      },
      {
        id: M4_DEMO_IDS.bobSession,
        websiteId: projectId,
        distinctId: 'user-bob',
        browser: 'firefox',
        os: 'Windows 11',
        device: 'desktop',
        country: 'CA',
        createdAt: at('2026-03-02T11:00:00.000Z'),
      },
      {
        id: M4_DEMO_IDS.caraSession,
        websiteId: projectId,
        distinctId: 'user-cara',
        browser: 'safari',
        os: 'iOS',
        device: 'mobile',
        country: 'ES',
        createdAt: at('2026-03-03T08:00:00.000Z'),
      },
    ],
  });

  const event = (id, sessionId, visitId, eventName, createdAt) => ({
    id,
    websiteId: projectId,
    sessionId,
    visitId,
    createdAt,
    urlPath: '/app/onboarding',
    eventType: 2,
    eventName,
  });

  await prisma.websiteEvent.createMany({
    skipDuplicates: true,
    data: [
      event(
        M4_DEMO_IDS.aliceSignup,
        M4_DEMO_IDS.aliceSession1,
        M4_DEMO_IDS.aliceVisit1,
        'signup',
        M4_DEMO_ANCHOR,
      ),
      event(
        M4_DEMO_IDS.aliceOnboarding,
        M4_DEMO_IDS.aliceSession1,
        M4_DEMO_IDS.aliceVisit1,
        'onboarding_completed',
        at('2026-03-01T09:20:00.000Z'),
      ),
      event(
        M4_DEMO_IDS.aliceActivation,
        M4_DEMO_IDS.aliceSession1,
        M4_DEMO_IDS.aliceVisit1,
        'core_feature_used',
        at('2026-03-01T09:45:00.000Z'),
      ),
      event(
        M4_DEMO_IDS.aliceReturn,
        M4_DEMO_IDS.aliceSession2,
        M4_DEMO_IDS.aliceVisit2,
        'core_feature_used',
        at('2026-03-08T10:00:00.000Z'),
      ),
      event(
        M4_DEMO_IDS.alicePurchase,
        M4_DEMO_IDS.aliceSession2,
        M4_DEMO_IDS.aliceVisit2,
        'subscription_started',
        at('2026-03-08T10:05:00.000Z'),
      ),
      event(
        M4_DEMO_IDS.bobSignup,
        M4_DEMO_IDS.bobSession,
        M4_DEMO_IDS.bobVisit,
        'signup',
        at('2026-03-02T11:00:00.000Z'),
      ),
      event(
        M4_DEMO_IDS.bobOnboarding,
        M4_DEMO_IDS.bobSession,
        M4_DEMO_IDS.bobVisit,
        'onboarding_completed',
        at('2026-03-02T11:20:00.000Z'),
      ),
      event(
        M4_DEMO_IDS.caraSignup,
        M4_DEMO_IDS.caraSession,
        M4_DEMO_IDS.caraVisit,
        'signup',
        at('2026-03-03T08:00:00.000Z'),
      ),
    ],
  });

  const sessionTrait = (id, sessionId, distinctId, dataKey, stringValue, createdAt) => ({
    id,
    websiteId: projectId,
    sessionId,
    distinctId,
    dataKey,
    stringValue,
    dataType: 1,
    createdAt,
  });

  await prisma.sessionData.createMany({
    skipDuplicates: true,
    data: [
      sessionTrait(
        'd5a950d4-4d31-4c0f-b7a4-41dce9e0a171',
        M4_DEMO_IDS.aliceSession1,
        'user-alice',
        'account_id',
        'acme-enterprise',
        M4_DEMO_ANCHOR,
      ),
      sessionTrait(
        'd5a950d4-4d31-4c0f-b7a4-41dce9e0a172',
        M4_DEMO_IDS.aliceSession2,
        'user-alice',
        'account_id',
        'acme-enterprise',
        at('2026-03-08T10:00:00.000Z'),
      ),
      sessionTrait(
        'd5a950d4-4d31-4c0f-b7a4-41dce9e0a173',
        M4_DEMO_IDS.bobSession,
        'user-bob',
        'account_id',
        'acme-enterprise',
        at('2026-03-02T11:00:00.000Z'),
      ),
      // Cara was observed in the self-serve account in her session. Her newer
      // current membership points at Acme, demonstrating current-only semantics.
      sessionTrait(
        'd5a950d4-4d31-4c0f-b7a4-41dce9e0a174',
        M4_DEMO_IDS.caraSession,
        'user-cara',
        'account_id',
        'beta-self-serve',
        at('2026-03-03T08:00:00.000Z'),
      ),
    ],
  });

  await prisma.revenue.createMany({
    skipDuplicates: true,
    data: [
      {
        id: M4_DEMO_IDS.enterpriseRevenue,
        websiteId: projectId,
        sessionId: M4_DEMO_IDS.aliceSession2,
        eventId: M4_DEMO_IDS.alicePurchase,
        eventName: 'subscription_started',
        currency: 'USD',
        revenue: 9900,
        createdAt: at('2026-03-08T10:05:00.000Z'),
      },
    ],
  });

  return {
    projectId,
    accountCount: 2,
    trackedUserCount: 3,
    sessionCount: 4,
    eventCount: 8,
    revenueCount: 1,
  };
}
