import { describe, expect, test, vi } from 'vitest';
import { liveSnapshotSchema } from './contracts';
import { createLiveSnapshotService } from './live-snapshot-service';

const now = new Date('2026-09-03T12:00:00.000Z').getTime();
const input = {
  projectId: '11111111-1111-4111-8111-111111111111',
  tenantId: 'workspace-a',
  permissionScope: 'identity-standard',
};

function realtimeResult() {
  return {
    totals: { views: 7, visitors: 3, events: 2, countries: 2, activeUsers: 2, activeAccounts: 1 },
    series: {
      views: [{ x: '2026-09-03T11:59:00.000Z', y: 7 }],
      visitors: [{ x: '2026-09-03T11:59:00.000Z', y: 3 }],
    },
    events: [
      {
        __type: 'event',
        sessionId: 'session-a',
        eventName: 'upgrade_clicked',
        createdAt: '2026-09-03T11:59:30.000Z',
        urlPath: '/billing',
        browser: 'chrome',
        device: 'desktop',
        country: 'US',
      },
      {
        __type: 'pageview',
        sessionId: 'session-b',
        eventName: null,
        createdAt: '2026-09-03T11:40:00.000Z',
        urlPath: '/pricing',
        browser: 'safari',
        device: 'mobile',
        country: 'GB',
      },
    ],
  };
}

describe('LiveSnapshot service', () => {
  test('returns a versioned bounded snapshot with freshness and explicit semantics', async () => {
    const service = createLiveSnapshotService({ load: vi.fn().mockResolvedValue(realtimeResult()), now: () => now });
    const snapshot = await service.execute(input);

    expect(liveSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot).toMatchObject({
      version: 1,
      generatedAt: '2026-09-03T12:00:00.000Z',
      freshnessAt: '2026-09-03T11:59:30.000Z',
      range: { boundary: '[start,end)', timezone: 'UTC', unit: 'minute' },
      transport: { kind: 'polling', recommendedPollMs: 10_000 },
      cache: 'miss',
    });
    expect(snapshot.activity).toHaveLength(2);
    expect(snapshot.topBehaviors[0]).toMatchObject({ label: 'upgrade_clicked', current: 1, previous: 0, changePercent: null });
  });

  test('shares concurrent misses and serves the short-lived cache', async () => {
    let release: ((value: ReturnType<typeof realtimeResult>) => void) | undefined;
    const load = vi.fn().mockReturnValue(new Promise(resolve => { release = resolve; }));
    const service = createLiveSnapshotService({ load, now: () => now });
    const first = service.execute(input);
    const second = service.execute(input);
    expect(load).toHaveBeenCalledTimes(1);
    release?.(realtimeResult());

    await expect(first).resolves.toMatchObject({ cache: 'miss' });
    await expect(second).resolves.toMatchObject({ cache: 'single-flight' });
    await expect(service.execute(input)).resolves.toMatchObject({ cache: 'hit' });
    expect(service.metrics()).toMatchObject({ requests: 3, loaderCalls: 1, cacheHits: 1, singleFlightHits: 1 });
  });

  test('isolates cache by tenant, project and permission scope', async () => {
    const load = vi.fn().mockResolvedValue(realtimeResult());
    const service = createLiveSnapshotService({ load, now: () => now });
    await service.execute(input);
    await service.execute({ ...input, tenantId: 'workspace-b' });
    await service.execute({ ...input, projectId: '22222222-2222-4222-8222-222222222222' });
    await service.execute({ ...input, permissionScope: 'identity-sensitive' });
    expect(load).toHaveBeenCalledTimes(4);
  });

  test('deduplicates a concurrent-viewer burst to one database load', async () => {
    const load = vi.fn().mockResolvedValue(realtimeResult());
    const service = createLiveSnapshotService({ load, now: () => now });
    const startedAt = performance.now();
    await Promise.all(Array.from({ length: 50 }, () => service.execute(input)));
    const durationMs = performance.now() - startedAt;

    expect(load).toHaveBeenCalledTimes(1);
    expect(service.metrics().loaderCalls).toBe(1);
    expect(durationMs).toBeLessThan(1_000);
  });
});
