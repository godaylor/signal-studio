import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Auth } from '@/lib/types';
import { exportDb as db } from '@/server/exports/database';
import { deleteWebsite } from '@/queries/prisma/website';
import { createAnalysisQueryService } from '@/server/analytics/query-service';
import { createLiveSnapshotService } from '@/server/live/live-snapshot-service';
import { createLifecycle, listLifecycle } from '@/server/lifecycle/service';
import { runLifecycleOnce } from '@/server/lifecycle/worker';

const projectId = randomUUID(); const backgroundId = randomUUID(); const namespace = randomUUID(); const owner = randomUUID();
const auth: Auth = { user: { id: owner, username: `load-${owner}`, role: 'user', isAdmin: false } };
const id = (kind: string, value: string) => `md5($2 || '-${kind}-' || ${value}::text)::uuid`;
const percentile = (values: number[], q: number) => [...values].sort((a,b) => a-b)[Math.ceil(values.length*q)-1];
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.includes('_test_')) throw new Error('Isolated _test_ database required');
  await db.user.create({ data: { id: owner, username: auth.user.username, role: 'user', password: '!'.repeat(60) } });
  await db.website.createMany({ data: [projectId, backgroundId].map(id => ({ id, userId: owner, name: 'M16 isolated concurrent load' })) });
  console.log('M16: seeding 1M events, 10k users/sessions, 1k accounts; no other heavy check is running.');
  await db.$executeRawUnsafe(`INSERT INTO tracked_user (tracked_user_id,project_id,external_id,first_seen_at,last_seen_at,updated_at) SELECT ${id('user','n')},$1::uuid,'load-'||n,'2026-03-01'::timestamptz,'2026-03-11'::timestamptz,now() FROM generate_series(0,9999)n`, projectId, namespace);
  await db.$executeRawUnsafe(`INSERT INTO tracked_account (tracked_account_id,project_id,external_id,first_seen_at,last_seen_at,updated_at) SELECT ${id('account','n')},$1::uuid,'load-account-'||n,'2026-03-01'::timestamptz,'2026-03-11'::timestamptz,now() FROM generate_series(0,999)n`, projectId, namespace);
  await db.$executeRawUnsafe(`INSERT INTO account_membership (account_membership_id,project_id,tracked_user_id,tracked_account_id,observed_at,updated_at) SELECT ${id('membership','n')},$1::uuid,${id('user','n')},${id('account','(n%1000)')},'2026-03-01'::timestamptz,now() FROM generate_series(0,9999)n`, projectId, namespace);
  await db.$executeRawUnsafe(`INSERT INTO session (session_id,website_id,distinct_id,created_at) SELECT ${id('session','n')},$1::uuid,'load-'||n,'2026-03-01'::timestamptz FROM generate_series(0,9999)n`, projectId, namespace);
  await db.$executeRawUnsafe(`INSERT INTO website_event (event_id,website_id,session_id,visit_id,created_at,url_path,event_type,event_name) SELECT ${id('event','n')},$1::uuid,${id('session','(n%10000)')},${id('session','(n%10000)')},'2026-03-01'::timestamptz+(n%864000)*interval '1 second','/app',2,CASE WHEN n%4=0 THEN 'signup' ELSE 'feature_used' END FROM generate_series(1,1000000)n`, projectId, namespace);
  await db.$executeRawUnsafe(`INSERT INTO heatmap_event (heatmap_event_id,website_id,session_id,visit_id,url_path,event_type,created_at) SELECT ${id('heatmap','n')},$1::uuid,${id('unused','n')},${id('unused','n')},'/test',1,'2025-01-01'::timestamptz FROM generate_series(1,20000)n`, backgroundId, namespace);
  await db.$executeRawUnsafe('ANALYZE website_event');
  await createLifecycle(auth, backgroundId, { version: 1, idempotencyKey: randomUUID(), confirmProjectId: backgroundId, category: 'heatmaps', target: { kind: 'project' }, before: '2026-01-01T00:00:00Z' });
  console.log('M16: fixture ready; starting five measured concurrency waves.');
}, 180000);
afterAll(async () => {
  for (let i=0; i<100; i++) {
    const jobs = await listLifecycle(auth, backgroundId);
    if (!jobs.some(job => ['queued','running'].includes(job.status))) break;
    await runLifecycleOnce();
  }
  await deleteWebsite(projectId); await deleteWebsite(backgroundId);
  await db.$executeRaw`DELETE FROM data_lifecycle_job WHERE project_id=${backgroundId}::uuid`;
  await db.securityAuditEvent.deleteMany({ where: { actorUserId: owner } });
  await db.user.delete({ where: { id: owner } }); await db.$disconnect();
}, 180000);
test('50 Live viewers and 20 four-widget dashboards remain bounded during background deletion', async () => {
  const widgets: number[] = []; const dashboards: number[] = []; const liveTimes: number[] = []; const cached: number[] = [];
  const waves: unknown[] = [];
  const query = (index: number) => ({ version: 1, projectId, mode: 'trend', range: { startAt: index<2 ? '2026-03-01T00:00:00Z' : '2026-03-02T00:00:00Z', endAt: '2026-03-11T00:00:00Z', timezone: 'UTC', unit: 'day' }, measure: { source: 'event', key: index%2 ? 'feature_used' : 'signup', aggregation: 'count' }, filters: [], match: 'all', comparison: 'none', visualization: 'line' });
  for (let wave=0; wave<5; wave++) {
    let executed = 0;
    const service = createAnalysisQueryService({ telemetry: event => { if (event.cache==='miss') executed++; } });
    const live = createLiveSnapshotService({ now: () => new Date('2026-03-11T00:00:00Z').getTime() });
    const common = { projectId, tenantId: projectId, permissionScope: 'identity-standard' };
    const work = (async () => { for(let n=0; n<5; n++) await runLifecycleOnce(); })();
    await Promise.all([
      ...Array.from({ length: 20 }, async () => { const start = performance.now(); await Promise.all(Array.from({ length: 4 }, async (_, index) => {
        const start = performance.now(); const result=await service.execute({ ...common, query: query(index), requestId: randomUUID() });
        widgets.push(performance.now()-start); if(index<2) expect(result.data.rows.reduce((sum,row) => sum+row.value,0)).toBe(index ? 750000 : 250000);
      })); dashboards.push(performance.now()-start); }),
      ...Array.from({ length: 50 }, async () => { const start=performance.now(); const snapshot=await live.execute(common); liveTimes.push(performance.now()-start); expect(snapshot.activity.length).toBeLessThanOrEqual(100); expect(snapshot.totals.activeUsers).toBeGreaterThan(0); }), work,
    ]);
    const start=performance.now(); await service.execute({ ...common, query: query(0), requestId: randomUUID() }); cached.push(performance.now()-start);
    expect(executed).toBe(4); expect(live.metrics().loaderCalls).toBe(1);
    waves.push({ wave, analysisExecutions: executed, live: live.metrics() });
    console.log(`M16 wave ${wave+1}: four unique analyses, one Live load, deletion progressing.`);
  }
  const report = { environment: `Windows ${process.version}; PostgreSQL15 Docker; isolated DB; no other benchmark/build`, dataset: { events: 1000000, users: 10000, accounts: 1000, sessions: 10000, rangeDays: 10, backgroundHeatmapRows: 20000 }, concurrency: { dashboardViewers: 20, widgetsPerDashboard: 4, liveViewers: 50, waves: 5 }, widget: { p50Ms: percentile(widgets,.5), p95Ms: percentile(widgets,.95) }, dashboard: { p50Ms: percentile(dashboards,.5), p95Ms: percentile(dashboards,.95) }, live: { p50Ms: percentile(liveTimes,.5), p95Ms: percentile(liveTimes,.95) }, cached: { p95Ms: percentile(cached,.95) }, waves };
  await mkdir('docs/evidence/m16', { recursive: true }); await writeFile('docs/evidence/m16/concurrent-1m.json', JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  expect(report.widget.p95Ms).toBeLessThanOrEqual(1500); expect(report.cached.p95Ms).toBeLessThanOrEqual(300); expect(report.live.p95Ms+5000).toBeLessThanOrEqual(10000);
}, 180000);
