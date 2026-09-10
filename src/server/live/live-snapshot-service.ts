import type { QueryFilters } from '@/lib/types';
import { getRealtimeData } from '@/queries/sql/getRealtimeData';
import {
  LIVE_CACHE_TTL_MS,
  LIVE_MAX_ACTIVITY,
  LIVE_POLL_MS,
  LIVE_RANGE_MINUTES,
  LIVE_SNAPSHOT_VERSION,
  liveSnapshotSchema,
  type LiveSnapshot,
} from './contracts';

type Loader = (projectId: string, filters: QueryFilters) => Promise<any>;

export interface LiveSnapshotInput {
  projectId: string;
  tenantId: string;
  permissionScope: string;
  requestId?: string;
}

type Metrics = {
  requests: number;
  loaderCalls: number;
  cacheHits: number;
  singleFlightHits: number;
  lastLoadMs: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toIso(value: unknown) {
  if (value == null) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSeries(rows: any[] = []) {
  return rows.map(row => ({
    time: toIso(row.x ?? row.time) ?? String(row.x ?? row.time ?? ''),
    value: toNumber(row.y ?? row.value),
  }));
}

function behaviorLabel(event: any) {
  return event.eventName ? String(event.eventName) : String(event.urlPath || 'Unknown page');
}

function getTopBehaviors(events: any[], midpoint: number) {
  const counts = new Map<string, { current: number; previous: number }>();

  for (const event of events) {
    if (event.__type === 'session') continue;
    const occurredAt = new Date(event.createdAt).getTime();
    if (!Number.isFinite(occurredAt)) continue;
    const key = `${event.eventName ? 'event' : 'page'}:${behaviorLabel(event)}`;
    const entry = counts.get(key) ?? { current: 0, previous: 0 };
    if (occurredAt >= midpoint) entry.current += 1;
    else entry.previous += 1;
    counts.set(key, entry);
  }

  return [...counts.entries()]
    .map(([key, value]) => ({
      key,
      label: key.slice(key.indexOf(':') + 1),
      ...value,
      changePercent:
        value.previous === 0
          ? value.current === 0
            ? 0
            : null
          : Math.round(((value.current - value.previous) / value.previous) * 100),
    }))
    .sort((a, b) => b.current - a.current || a.label.localeCompare(b.label))
    .slice(0, 8);
}

export function createLiveSnapshotService({
  load = getRealtimeData,
  now = () => Date.now(),
  ttlMs = LIVE_CACHE_TTL_MS,
}: {
  load?: Loader;
  now?: () => number;
  ttlMs?: number;
} = {}) {
  const cache = new Map<string, { expiresAt: number; snapshot: LiveSnapshot }>();
  const inFlight = new Map<string, Promise<LiveSnapshot>>();
  const metrics: Metrics = {
    requests: 0,
    loaderCalls: 0,
    cacheHits: 0,
    singleFlightHits: 0,
    lastLoadMs: 0,
  };

  function key(input: LiveSnapshotInput) {
    return [
      `v${LIVE_SNAPSHOT_VERSION}`,
      input.tenantId,
      input.projectId,
      input.permissionScope,
      process.env.DATABASE_TYPE ?? 'postgresql',
    ].join(':');
  }

  async function loadSnapshot(input: LiveSnapshotInput): Promise<LiveSnapshot> {
    const generatedAt = now();
    const start = generatedAt - LIVE_RANGE_MINUTES * 60_000;
    const startedAt = performance.now();
    metrics.loaderCalls += 1;
    const raw = await load(input.projectId, {
      startDate: new Date(start),
      endDate: new Date(generatedAt),
      timezone: 'UTC',
      unit: 'minute',
    });
    metrics.lastLoadMs = Math.round(performance.now() - startedAt);
    const rawEvents = Array.isArray(raw.events) ? raw.events : [];
    const activity: LiveSnapshot['activity'] = rawEvents
      .slice(0, LIVE_MAX_ACTIVITY)
      .map((event: any, index: number) => ({
        id: `${event.sessionId}:${toIso(event.createdAt) ?? 'unknown'}:${index}`,
        type: (['session', 'event'].includes(event.__type)
          ? event.__type
          : 'pageview') as LiveSnapshot['activity'][number]['type'],
        sessionId: String(event.sessionId ?? ''),
        eventName: event.eventName ? String(event.eventName) : null,
        createdAt: toIso(event.createdAt),
        urlPath: event.urlPath ? String(event.urlPath) : null,
        browser: event.browser ? String(event.browser) : null,
        device: event.device ? String(event.device) : null,
        country: event.country ? String(event.country) : null,
      }));
    const freshnessAt = activity.reduce<string | null>((latest, event) => {
      if (!event.createdAt) return latest;
      return !latest || event.createdAt > latest ? event.createdAt : latest;
    }, null);

    return liveSnapshotSchema.parse({
      version: LIVE_SNAPSHOT_VERSION,
      snapshotId: `${input.projectId}:${generatedAt}`,
      generatedAt: new Date(generatedAt).toISOString(),
      freshnessAt,
      range: {
        start: new Date(start).toISOString(),
        end: new Date(generatedAt).toISOString(),
        boundary: '[start,end)',
        timezone: 'UTC',
        unit: 'minute',
      },
      transport: { kind: 'polling', recommendedPollMs: LIVE_POLL_MS, cacheTtlMs: ttlMs },
      cache: 'miss',
      totals: {
        views: toNumber(raw.totals?.views),
        visitors: toNumber(raw.totals?.visitors),
        events: toNumber(raw.totals?.events),
        countries: toNumber(raw.totals?.countries),
        activeUsers: toNumber(raw.totals?.activeUsers),
        activeAccounts: toNumber(raw.totals?.activeAccounts),
      },
      series: {
        views: normalizeSeries(raw.series?.views),
        visitors: normalizeSeries(raw.series?.visitors),
      },
      activity,
      topBehaviors: getTopBehaviors(rawEvents, start + (generatedAt - start) / 2),
      warnings: [],
      definitions: {
        activeUsers: 'Distinct identified tracked users observed in the trailing 30-minute window.',
        activeAccounts: 'Distinct linked accounts observed in the trailing 30-minute window.',
        lateArrivals: 'Late-arriving events appear in the next successful snapshot while in range.',
      },
    });
  }

  return {
    async execute(input: LiveSnapshotInput): Promise<LiveSnapshot> {
      metrics.requests += 1;
      const cacheKey = key(input);
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > now()) {
        metrics.cacheHits += 1;
        return { ...cached.snapshot, cache: 'hit' };
      }

      const pending = inFlight.get(cacheKey);
      if (pending) {
        metrics.singleFlightHits += 1;
        return { ...(await pending), cache: 'single-flight' };
      }

      const promise = loadSnapshot(input);
      inFlight.set(cacheKey, promise);
      try {
        const snapshot = await promise;
        cache.set(cacheKey, { snapshot, expiresAt: now() + ttlMs });
        if (cache.size > 250) cache.delete(cache.keys().next().value as string);
        return snapshot;
      } finally {
        inFlight.delete(cacheKey);
      }
    },
    metrics: () => ({ ...metrics }),
    clear() {
      cache.clear();
      inFlight.clear();
      Object.assign(metrics, {
        requests: 0,
        loaderCalls: 0,
        cacheHits: 0,
        singleFlightHits: 0,
        lastLoadMs: 0,
      });
    },
  };
}

export const liveSnapshotService = createLiveSnapshotService();
