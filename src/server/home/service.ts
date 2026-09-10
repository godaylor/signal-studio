import prisma from '@/lib/prisma';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
import { analysisQueryService } from '@/server/analytics/query-service';
import type { ProjectAccess } from '@/server/permissions/capabilities';
import { projectDataScopeForCapabilities } from '@/server/permissions/project-data';
import type { HomeSnapshot } from './contracts';
import { homeQueries, homeRanges } from './queries';

export async function getHomeSnapshot(
  access: ProjectAccess,
  signal?: AbortSignal,
  now = new Date(),
): Promise<HomeSnapshot> {
  if (!access.capabilities.viewAggregate) throw new Error('home-access-denied');
  const projectId = access.projectId;
  const { activeRange, cohortRange } = homeRanges(now);
  const currencies = await prisma.client.revenue.findMany({
    where: {
      websiteId: projectId,
      createdAt: {
        gte: new Date(new Date(activeRange.startAt).getTime() - 7 * 86_400_000),
        lt: new Date(activeRange.endAt),
      },
    },
    select: { currency: true },
    distinct: ['currency'],
    orderBy: { currency: 'asc' },
    take: 6,
  });
  const metrics: HomeSnapshot['metrics'] = [];
  // Bounded sequential fan-out protects interactive queries on small portfolio hosts.
  for (const item of homeQueries(
    projectId,
    now,
    currencies
      .slice(0, 5)
      .map(item => item.currency)
      .filter(value => /^[A-Z]{3}$/.test(value)),
  )) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      metrics.push({
        ...item,
        result: await analysisQueryService.execute({
          query: item.query,
          projectId,
          tenantId: access.workspaceId,
          permissionScope: projectDataScopeForCapabilities(access.capabilities),
          signal,
        }),
        error: null,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      metrics.push({ ...item, result: null, error: 'home-metric-unavailable' });
    }
  }
  const [health, accounts, insights] = await Promise.all([
    prisma.rawQuery(
      `select max(created_at) as latest,
      count(*) filter (where created_at >= {{since}}) as recent
      from website_event where website_id = {{projectId::uuid}} and created_at < {{now}}`,
      { projectId, since: new Date(now.getTime() - 86_400_000), now },
      'home_health',
    ) as Promise<Array<{ latest: Date | null; recent: bigint }>>,
    access.capabilities.viewIdentity
      ? prisma.client.trackedAccount.findMany({
          where: { projectId, lastSeenAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
          select: { id: true, name: true, externalId: true, lastSeenAt: true },
          orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
          take: 10,
        })
      : Promise.resolve([]),
    prisma.client.insight.findMany({
      where: { projectId, status: 'active' },
      select: {
        id: true,
        title: true,
        description: true,
        query: true,
        queryVersion: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 6,
    }),
  ]);
  const latest = health[0]?.latest ? new Date(health[0].latest) : null;
  return {
    generatedAt: now.toISOString(),
    activeRange,
    cohortRange,
    metrics,
    currenciesTruncated: currencies.length > 5,
    health: {
      lastEventAt: latest?.toISOString() ?? null,
      observedEvents24h: Number(health[0]?.recent ?? 0),
      state: !latest
        ? 'empty'
        : now.getTime() - latest.getTime() > 86_400_000
          ? 'stale'
          : 'observed',
      deliveryLoss: 'unknown',
    },
    atRisk: {
      permitted: access.capabilities.viewIdentity,
      accounts: accounts.map(account => ({
        id: account.id,
        label: access.capabilities.viewSensitiveTraits
          ? (account.name ?? account.externalId)
          : 'Account ' + account.id.slice(0, 8),
        lastSeenAt: account.lastSeenAt.toISOString(),
      })),
    },
    recent: insights.map(insight => {
      let query: HomeSnapshot['recent'][number]['query'] = null;
      try {
        if (insight.queryVersion === 1) query = normalizeAnalysisQuery(insight.query);
      } catch {
        /* Explicit unsupported state; never silently migrate. */
      }
      return {
        id: insight.id,
        title: insight.title,
        description: insight.description,
        query,
        updatedAt: insight.updatedAt.toISOString(),
      };
    }),
  };
}
