import { z } from 'zod';

export const LIVE_SNAPSHOT_VERSION = 1 as const;
export const LIVE_RANGE_MINUTES = 30;
export const LIVE_POLL_MS = 10_000;
export const LIVE_CACHE_TTL_MS = 8_000;
export const LIVE_MAX_ACTIVITY = 100;

const nullableText = z.string().nullable();

export const liveSnapshotSchema = z.object({
  version: z.literal(LIVE_SNAPSHOT_VERSION),
  snapshotId: z.string().min(1),
  generatedAt: z.string().datetime(),
  freshnessAt: z.string().datetime().nullable(),
  range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    boundary: z.literal('[start,end)'),
    timezone: z.literal('UTC'),
    unit: z.literal('minute'),
  }),
  transport: z.object({
    kind: z.enum(['polling', 'sse']),
    recommendedPollMs: z.number().int().positive(),
    cacheTtlMs: z.number().int().positive(),
  }),
  cache: z.enum(['miss', 'hit', 'single-flight']),
  totals: z.object({
    views: z.number().nonnegative(),
    visitors: z.number().nonnegative(),
    events: z.number().nonnegative(),
    countries: z.number().nonnegative(),
    activeUsers: z.number().nonnegative(),
    activeAccounts: z.number().nonnegative(),
  }),
  series: z.object({
    views: z.array(z.object({ time: z.string(), value: z.number() })),
    visitors: z.array(z.object({ time: z.string(), value: z.number() })),
  }),
  activity: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['session', 'pageview', 'event']),
        sessionId: z.string(),
        eventName: nullableText,
        createdAt: z.string().datetime().nullable(),
        urlPath: nullableText,
        browser: nullableText,
        device: nullableText,
        country: nullableText,
      }),
    )
    .max(LIVE_MAX_ACTIVITY),
  topBehaviors: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      current: z.number().int().nonnegative(),
      previous: z.number().int().nonnegative(),
      changePercent: z.number().nullable(),
    }),
  ),
  warnings: z.array(z.string()),
  definitions: z.object({
    activeUsers: z.string(),
    activeAccounts: z.string(),
    lateArrivals: z.string(),
  }),
});

export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;
