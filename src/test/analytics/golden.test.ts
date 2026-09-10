import { describe, expect, test } from 'vitest';
import {
  GOLDEN_DATASET,
  GOLDEN_DEFINITIONS,
  GOLDEN_RANGE,
  summarizeLegacyProduction,
  summarizeProductIntent,
} from './golden';

describe('Signal Studio deterministic analytics golden seed', () => {
  test('documents identity, product-intent and legacy production units separately', () => {
    expect(Object.keys(GOLDEN_DEFINITIONS.identities)).toEqual([
      'visitor',
      'user',
      'account',
      'session',
      'event',
    ]);
    expect(GOLDEN_DEFINITIONS.productIntent.funnel.unit).toContain('product userId');
    expect(GOLDEN_DEFINITIONS.legacyProduction.funnel.unit).toContain('sessionId');
    expect(GOLDEN_DEFINITIONS.productIntent.retention.unit).toContain('product userId');
    expect(GOLDEN_DEFINITIONS.legacyProduction.retention.unit).toContain('sessionId');
    expect(GOLDEN_DEFINITIONS.legacyProduction.retention.inclusion).toContain('anonymous');
    expect(GOLDEN_DATASET.accounts).toHaveLength(2);
    expect(GOLDEN_DATASET.users).toHaveLength(3);
  });

  test('makes repeated visitor, user and session identities observably different', () => {
    const product = summarizeProductIntent();

    expect(product.identities).toEqual({
      visitors: 4,
      users: 3,
      accounts: 2,
      sessions: 5,
      events: 17,
    });
  });

  test('counts bounce per visit tuple when one session has different visit behavior', () => {
    const alicePrimaryVisit = GOLDEN_DATASET.events.filter(
      item =>
        item.sessionId === 'session-alice-onboarding' && item.visitId === 'visit-alice-onboarding',
    );
    const aliceBounceVisit = GOLDEN_DATASET.events.filter(
      item =>
        item.sessionId === 'session-alice-onboarding' && item.visitId === 'visit-alice-bounce',
    );

    expect(alicePrimaryVisit.some(item => item.name !== 'page_view')).toBe(true);
    expect(aliceBounceVisit.map(item => item.name)).toEqual(['page_view']);
    expect(summarizeLegacyProduction().websiteStats).toMatchObject({ visits: 6, bounces: 2 });
  });

  test('produces exact product-intent user activation, funnel and retention', () => {
    expect(summarizeProductIntent()).toMatchInlineSnapshot(`
      {
        "activation": {
          "activatedUsers": 2,
          "eligibleUsers": 3,
          "rate": 0.6666666666666666,
        },
        "funnel": [
          {
            "step": "signup",
            "users": 3,
          },
          {
            "step": "onboarding_completed",
            "users": 3,
          },
          {
            "step": "core_feature_used",
            "users": 2,
          },
        ],
        "identities": {
          "accounts": 2,
          "events": 17,
          "sessions": 5,
          "users": 3,
          "visitors": 4,
        },
        "range": {
          "endExclusive": "2026-03-11T04:00:00.000Z",
          "start": "2026-03-07T05:00:00.000Z",
        },
        "retention": {
          "activatedUsers": 2,
          "dayOneRate": 0.5,
          "dayOneUsers": 1,
        },
        "timezone": "America/New_York",
      }
    `);
  });

  test('does not retain an activated user for an unrelated later page view', () => {
    const withoutReturnBehavior = GOLDEN_DATASET.events.filter(
      item => !['e06', 'e07', 'e08'].includes(item.id),
    );

    expect(
      summarizeProductIntent(GOLDEN_RANGE, 'America/New_York', withoutReturnBehavior).retention,
    ).toEqual({
      activatedUsers: 2,
      dayOneUsers: 0,
      dayOneRate: 0,
    });
  });

  test('produces different exact legacy session funnel and first-touch retention', () => {
    expect(summarizeLegacyProduction()).toEqual({
      websiteStats: {
        pageviews: 6,
        visitorsFieldSessions: 5,
        visits: 6,
        bounces: 2,
        totalTimeSeconds: 0,
      },
      funnel: [
        { step: 'signup', sessions: 4 },
        { step: 'onboarding_completed', sessions: 4 },
        { step: 'core_feature_used', sessions: 3 },
      ],
      retention: [
        { cohort: '2026-03-07', day: 0, sessions: 2, returnSessions: 2, percentage: 100 },
        { cohort: '2026-03-08', day: 0, sessions: 1, returnSessions: 1, percentage: 100 },
        { cohort: '2026-03-09', day: 0, sessions: 1, returnSessions: 1, percentage: 100 },
        { cohort: '2026-03-10', day: 0, sessions: 1, returnSessions: 1, percentage: 100 },
      ],
    });
  });

  test('excludes a funnel step exactly at end and includes it in the adjacent range', () => {
    const adjacent = {
      startDate: GOLDEN_RANGE.endDate,
      endDate: new Date(GOLDEN_RANGE.endDate.getTime() + 60_000),
    };

    expect(summarizeProductIntent().identities.events).toBe(17);
    expect(summarizeLegacyProduction().funnel[0]).toEqual({ step: 'signup', sessions: 4 });
    expect(summarizeLegacyProduction(adjacent).funnel[0]).toEqual({ step: 'signup', sessions: 1 });
  });
});
