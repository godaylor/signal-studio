import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Explicit, additive demo seed. Each UTC week owns a separate immutable project.
const day = 86_400_000;
const now = new Date();
const weekEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
weekEnd.setUTCDate(weekEnd.getUTCDate() - ((weekEnd.getUTCDay() + 6) % 7));
const active = weekEnd.getTime() - 7 * day;
const cohort = weekEnd.getTime() - 28 * day;
const domain = 'portfolio-' + weekEnd.toISOString().slice(0, 10) + '.demo.invalid';
const url = new URL(process.env.DATABASE_URL ?? '');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
try {
  const existing = await db.website.findFirst({ where: { domain, deletedAt: null }, select: { id: true } });
  if (existing) {
    console.log('Portfolio demo already exists: /studio/' + existing.id + '/home');
  } else {
    const admin = await db.user.findFirst({ where: { role: 'admin', deletedAt: null, username: { not: 'admin' } }, select: { id: true } });
    if (!admin) throw new Error('Bootstrap a non-demo administrator first.');
    const projectId = randomUUID();
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(1660944385)::text`;
      if (await tx.website.findFirst({ where: { domain, deletedAt: null } })) throw new Error('Demo created concurrently; run again.');
      const teamId = randomUUID();
      await tx.team.create({ data: { id: teamId, name: 'Signal Studio Portfolio' } });
      await tx.teamUser.create({ data: { id: randomUUID(), teamId, userId: admin.id, role: 'team-owner', studioRole: 'owner' } });
      await tx.website.create({ data: { id: projectId, teamId, createdBy: admin.id, name: 'Portfolio · Activation Lab', domain, replayConfig: { replayEnabled: true, maskLevel: 'strict' } } });
      const accounts = [randomUUID(), randomUUID()];
      await tx.trackedAccount.createMany({ data: accounts.map((id, i) => ({
        id, projectId, externalId: i ? 'beta-starter' : 'acme-enterprise',
        name: i ? 'Beta Works · Demo' : 'Acme Cloud · Demo',
        traits: { plan: i ? 'starter' : 'enterprise', industry: 'software' },
        lifecycleStage: i ? 'onboarding' : 'retained',
        firstSeenAt: new Date(cohort - 7 * day), lastSeenAt: new Date(i ? cohort : now.getTime()),
      })) });
      for (let i = 0; i < 6; i++) {
        const trackedUserId = randomUUID(), sessionId = randomUUID(), visitId = randomUUID();
        const externalId = 'portfolio-user-' + i;
        const entry = cohort + (i < 4 ? 0 : -7 * day);
        await tx.trackedUser.create({ data: { id: trackedUserId, projectId, externalId, displayName: ['Alice', 'Bob', 'Cara', 'Dan', 'Eva', 'Finn'][i] + ' · Demo', traits: { plan: i % 2 ? 'starter' : 'enterprise' }, firstSeenAt: new Date(entry), lastSeenAt: new Date(i < 3 ? active : entry) } });
        await tx.accountMembership.create({ data: { id: randomUUID(), projectId, trackedUserId, trackedAccountId: accounts[i % 2], observedAt: new Date(entry) } });
        await tx.session.create({ data: { id: sessionId, websiteId: projectId, distinctId: externalId, createdAt: new Date(entry), browser: 'chrome', os: 'Windows 10', device: 'desktop', country: i % 2 ? 'DE' : 'US' } });
        await tx.sessionLink.create({ data: { websiteId: projectId, sessionId, distinctId: externalId, createdAt: new Date(entry) } });
        async function event(time, eventName) {
          const id = randomUUID();
          await tx.websiteEvent.create({ data: { id, websiteId: projectId, sessionId, visitId, createdAt: new Date(time), eventType: 2, eventName, urlPath: '/app/onboarding' } });
          return id;
        }
        await event(entry, 'signup');
        if (i < 2 || i >= 4) {
          await event(entry + 60_000, 'onboarding_completed');
          await event(entry + 120_000, 'core_feature_used');
          if (i === 0 || i >= 4) await event(entry + 7 * day + 120_000, 'core_feature_used');
        } else if (i === 2) await event(entry + 60_000, 'onboarding_completed');
        if (i < 3) await event(active + 60_000, 'feature_report');
        if (i === 0) {
          const eventId = await event(active + 120_000, 'purchase');
          await tx.revenue.create({ data: { id: randomUUID(), websiteId: projectId, sessionId, eventId, eventName: 'purchase', currency: 'USD', revenue: 149, createdAt: new Date(active + 120_000) } });
          await event(now.getTime() - 10_000, 'demo_review');
          const timestamp = entry + 120_000;
          const replay = [
            { type: 4, timestamp, data: { href: 'https://' + domain + '/app/onboarding', width: 1280, height: 720 } },
            { type: 2, timestamp: timestamp + 1, data: { node: { type: 0, id: 1, childNodes: [{ type: 2, id: 2, tagName: 'html', attributes: {}, childNodes: [{ type: 2, id: 3, tagName: 'head', attributes: {}, childNodes: [] }, { type: 2, id: 4, tagName: 'body', attributes: {}, childNodes: [{ type: 2, id: 5, tagName: 'main', attributes: {}, childNodes: [{ type: 3, id: 6, textContent: 'Signal Studio · synthetic onboarding demo. No real personal data.', isStyle: false }] }] }] }] }, initialOffset: { top: 0, left: 0 } } },
          ];
          await tx.sessionReplay.create({ data: { id: randomUUID(), websiteId: projectId, sessionId, visitId, chunkIndex: 0, events: gzipSync(Buffer.from(JSON.stringify(replay))), eventCount: replay.length, startedAt: new Date(timestamp), endedAt: new Date(timestamp + 1000) } });
        }
      }
      const query = { version: 1, projectId, mode: 'trend', range: { startAt: new Date(cohort).toISOString(), endAt: new Date(cohort + 7 * day).toISOString(), timezone: 'UTC', unit: 'week' }, measure: { source: 'lifecycle', key: 'activated', aggregation: 'count' }, filters: [], match: 'all', comparison: 'previousPeriod', visualization: 'table' };
      await tx.insight.create({ data: { id: randomUUID(), projectId, ownerId: admin.id, title: 'Activation declined · 100% → 50%', description: 'Synthetic portfolio data. Compare enterprise and starter accounts, inspect onboarding drop-off, then save your findings.', queryVersion: 1, query, visualization: {}, status: 'active' } });
    }, { timeout: 30_000 });
    console.log('Portfolio demo created: /studio/' + projectId + '/home');
  }
} finally { await db.$disconnect(); }
