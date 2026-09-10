import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import prisma from '../../src/lib/prisma';
import { SAFE_SHARE_SCOPE } from '../../src/server/shares/contracts';

const ids = {
  owner: randomUUID(),
  workspace: randomUUID(),
  project: randomUUID(),
  membership: randomUUID(),
  insight: randomUUID(),
  share: randomUUID(),
  slug: randomUUID().replaceAll('-', ''),
};

test.beforeAll(async () => {
  await prisma.client.user.create({
    data: {
      id: ids.owner,
      username: `m14-public-${ids.owner}`,
      password: 'x'.repeat(60),
      role: 'user',
    },
  });
  await prisma.client.team.create({
    data: { id: ids.workspace, name: `M14 public ${ids.workspace.slice(0, 8)}` },
  });
  await prisma.client.website.create({
    data: {
      id: ids.project,
      name: 'M14 public project',
      domain: 'm14-public.example',
      teamId: ids.workspace,
    },
  });
  await prisma.client.teamUser.create({
    data: {
      id: ids.membership,
      teamId: ids.workspace,
      userId: ids.owner,
      role: 'team-owner',
      studioRole: 'owner',
      capabilityOverrides: {},
    },
  });
  await prisma.client.insight.create({
    data: {
      id: ids.insight,
      projectId: ids.project,
      ownerId: ids.owner,
      title: 'M14 safe public Insight',
      description: 'Aggregate-only public evidence',
      queryVersion: 1,
      query: {
        version: 1,
        projectId: ids.project,
        mode: 'trend',
        range: {
          startAt: '2026-01-01T00:00:00.000Z',
          endAt: '2026-01-08T00:00:00.000Z',
          timezone: 'UTC',
          unit: 'day',
        },
        measure: { source: 'event', key: 'pageview', aggregation: 'count' },
        filters: [],
        match: 'all',
        comparison: 'none',
        visualization: 'line',
      },
    },
  });
  await prisma.client.share.create({
    data: {
      id: ids.share,
      entityId: ids.insight,
      projectId: ids.project,
      createdBy: ids.owner,
      name: 'M14 safe public share',
      shareType: 5,
      resourceType: 'insight',
      visibility: 'public',
      slug: ids.slug,
      parameters: { version: 1 },
      scope: SAFE_SHARE_SCOPE,
      tokenVersion: 1,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
});

test.afterAll(async () => {
  await prisma.client.share.deleteMany({ where: { id: ids.share } });
  await prisma.client.insight.deleteMany({ where: { id: ids.insight } });
  await prisma.client.teamUser.deleteMany({ where: { id: ids.membership } });
  await prisma.client.website.deleteMany({ where: { id: ids.project } });
  await prisma.client.team.deleteMany({ where: { id: ids.workspace } });
  await prisma.client.user.deleteMany({ where: { id: ids.owner } });
  await prisma.client.$disconnect();
});

test('public Insight is aggregate-only, bilingual, and revoked from the live record', async ({
  page,
  request,
}) => {
  await page.goto(`/share/${ids.slug}`);

  await expect(page.getByRole('heading', { name: 'M14 safe public Insight' })).toBeVisible();
  await expect(page.getByText('Signal Studio · Публичный просмотр')).toBeVisible();
  await expect(page.getByLabel('Язык').getByRole('button')).toHaveCount(2);
  await expect(page.getByText('externalId')).toHaveCount(0);
  await expect(page.getByText('sensitiveTraits')).toHaveCount(0);
  await expect(page.getByText(/replay/i)).toHaveCount(0);

  await page.getByLabel('Язык').getByRole('button', { name: 'EN' }).click();
  await expect(page.getByText('Signal Studio · Public view')).toBeVisible();

  await prisma.client.share.update({
    where: { id: ids.share },
    data: { revokedAt: new Date(), tokenVersion: { increment: 1 } },
  });

  const response = await request.get(`/api/share/${ids.slug}`);
  expect(response.status()).toBe(404);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'M14 safe public Insight' })).toHaveCount(0);
});
