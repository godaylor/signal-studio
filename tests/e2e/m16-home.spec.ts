import { randomBytes, randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import prisma from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/password';
import { homeRanges } from '../../src/server/home/queries';
import { serializeAnalysisQuery } from '../../src/server/analytics/url-codec';
import { loginPage, loginViaApi, authHeaders } from './helpers';
const ids = { project: randomUUID(), workspace: randomUUID(), owner: randomUUID(), viewer: randomUUID(), account: randomUUID(), insight: randomUUID() };
const password = randomBytes(32).toString('base64url');
const username = 'm16-home-' + ids.owner;
const viewerUsername = 'm16-viewer-' + ids.viewer;
const { cohortRange, activeRange } = homeRanges(new Date());
const start = new Date(cohortRange.startAt).getTime();
const day = 86_400_000;
const users = Array.from({ length: 6 }, () => randomUUID());
const sessions = users.map(() => randomUUID());

test.beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL ?? '').pathname.includes('_test_')) throw new Error('Isolated test DB required');
  await prisma.client.user.createMany({ data: [{ id: ids.owner, username }, { id: ids.viewer, username: viewerUsername }].map(user => ({ ...user, password: hashPassword(password), role: 'user' })) });
  await prisma.client.team.create({ data: { id: ids.workspace, name: 'M16 Home acceptance' } });
  await prisma.client.website.create({ data: { id: ids.project, teamId: ids.workspace, name: 'Home golden product', domain: 'home-golden.test' } });
  await prisma.client.teamUser.createMany({ data: [{ userId: ids.owner, studioRole: 'owner', role: 'team-owner' }, { userId: ids.viewer, studioRole: 'viewer', role: 'team-view-only' }].map(member => ({ id: randomUUID(), teamId: ids.workspace, ...member })) });
  await prisma.client.trackedAccount.create({ data: { id: ids.account, projectId: ids.project, externalId: 'home-account', name: 'Home at-risk account', firstSeenAt: new Date(start), lastSeenAt: new Date(start + day) } });
  await prisma.client.trackedUser.createMany({ data: users.map((id, index) => ({ id, projectId: ids.project, externalId: 'home-user-' + index, firstSeenAt: new Date(start - 7 * day), lastSeenAt: new Date(activeRange.startAt) })) });
  await prisma.client.accountMembership.createMany({ data: users.map(trackedUserId => ({ id: randomUUID(), projectId: ids.project, trackedUserId, trackedAccountId: ids.account, observedAt: new Date(start) })) });
  await prisma.client.session.createMany({ data: sessions.map((id, index) => ({ id, websiteId: ids.project, distinctId: 'home-user-' + index, createdAt: new Date(start - 7 * day) })) });
  async function event(index: number, time: number, eventName: string) {
    const id = randomUUID();
    await prisma.client.websiteEvent.create({ data: { id, websiteId: ids.project, sessionId: sessions[index], visitId: randomUUID(), createdAt: new Date(time), urlPath: '/app', eventType: 2, eventName } });
    return id;
  }
  for (let index = 0; index < 6; index++) {
    const entry = start + (index < 4 ? 0 : -7 * day);
    await event(index, entry, 'signup');
    if (index < 2 || index >= 4) {
      await event(index, entry + 60_000, 'onboarding_completed');
      await event(index, entry + 120_000, 'core_feature_used');
      if (index === 0 || index >= 4) await event(index, entry + 7 * day + 120_000, 'core_feature_used');
    }
    if (index < 3) await event(index, new Date(activeRange.startAt).getTime() + 60_000, 'feature_report');
  }
  const revenueEvent = await event(0, new Date(activeRange.startAt).getTime() + 120_000, 'purchase');
  await prisma.client.revenue.create({ data: { id: randomUUID(), websiteId: ids.project, sessionId: sessions[0], eventId: revenueEvent, eventName: 'purchase', currency: 'USD', revenue: 30, createdAt: new Date(activeRange.startAt) } });
  const query = { version: 1, projectId: ids.project, mode: 'trend', range: { ...cohortRange, timezone: 'UTC', unit: 'week' }, measure: { source: 'lifecycle', key: 'activated', aggregation: 'count' }, filters: [], match: 'all', comparison: 'previousPeriod', visualization: 'table' };
  await prisma.client.insight.create({ data: { id: ids.insight, projectId: ids.project, ownerId: ids.owner, title: 'Activation declined', description: 'Investigate onboarding completion.', queryVersion: 1, query, visualization: {}, status: 'active' } });
});
test.afterAll(async () => {
  await prisma.client.insight.deleteMany({ where: { projectId: ids.project } });
  await prisma.client.revenue.deleteMany({ where: { websiteId: ids.project } });
  await prisma.client.websiteEvent.deleteMany({ where: { websiteId: ids.project } });
  await prisma.client.session.deleteMany({ where: { websiteId: ids.project } });
  await prisma.client.accountMembership.deleteMany({ where: { projectId: ids.project } });
  await prisma.client.trackedUser.deleteMany({ where: { projectId: ids.project } });
  await prisma.client.trackedAccount.deleteMany({ where: { projectId: ids.project } });
  await prisma.client.securityAuditEvent.deleteMany({ where: { actorUserId: { in: [ids.owner, ids.viewer] } } });
  await prisma.client.teamUser.deleteMany({ where: { teamId: ids.workspace } });
  await prisma.client.website.deleteMany({ where: { id: ids.project } });
  await prisma.client.team.deleteMany({ where: { id: ids.workspace } });
  await prisma.client.user.deleteMany({ where: { id: { in: [ids.owner, ids.viewer] } } });
  await prisma.client.$disconnect();
});
test('Home API has exact activation decline and server-enforced Viewer / tenant boundaries', async ({ request }) => {
  expect((await request.get('/api/projects/' + ids.project + '/home')).status()).toBe(401);
  const owner = await loginViaApi(request, username, password);
  const response = await request.get('/api/projects/' + ids.project + '/home', { headers: authHeaders(owner) });
  expect(response.status()).toBe(200);
  const snapshot = await response.json();
  const activation = snapshot.metrics.find(item => item.id === 'activation');
  expect(activation.result.data.total).toEqual({ value: 2, denominator: 4, rate: 0.5 });
  expect(activation.result.data.comparisonTotal).toEqual({ value: 2, denominator: 2, rate: 1 });
  expect(snapshot.metrics.find(item => item.id === 'users').result.data.total.value).toBe(3);
  expect(snapshot.metrics.find(item => item.id === 'accounts').result.data.total.value).toBe(1);
  expect(snapshot.metrics.find(item => item.id === 'revenue:USD').result.data.total.value).toBe(30);
  const reproduced = await request.post('/api/projects/' + ids.project + '/analytics/query', { headers: authHeaders(owner), data: activation.query });
  expect((await reproduced.json()).data.total).toEqual(activation.result.data.total);
  const viewer = await loginViaApi(request, viewerUsername, password);
  const viewerHome = await request.get('/api/projects/' + ids.project + '/home', { headers: authHeaders(viewer) });
  expect((await viewerHome.json()).atRisk).toEqual({ permitted: false, accounts: [] });
  expect((await request.get('/api/projects/' + ids.project + '/accounts', { headers: authHeaders(viewer) })).status()).toBe(403);
  expect((await request.get('/api/projects/' + randomUUID() + '/home', { headers: authHeaders(owner) })).status()).toBe(403);
});
for (const russian of [false, true]) {
  test('Home ' + (russian ? 'RU mobile' : 'EN desktop') + ' → Explore → account, axe and keyboard', async ({ page, request }) => {
    const auth = await loginViaApi(request, username, password);
    await page.addInitScript(({ token, locale }) => { localStorage.setItem('umami.auth', JSON.stringify(token)); localStorage.setItem('umami.locale', JSON.stringify(locale)); }, { token: auth.token, locale: russian ? 'ru-RU' : 'en-US' });
    if (russian) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/studio/' + ids.project + '/home?locale=' + (russian ? 'ru-RU' : 'en-US'));
    await expect(page.getByRole('heading', { name: 'Home golden product', exact: true })).toHaveCount(0);
    const open = page.getByRole('link', { name: russian ? 'Открыть определение в анализе' : 'Open definition in Explore', exact: true }).first();
    await expect(open).toBeVisible();
    await expect(page.getByText('Activation declined', { exact: true })).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.local/m16-home-' + (russian ? 'ru-mobile' : 'en-desktop') + '.png', fullPage: true });
    await open.focus(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/source=lifecycle/);
    await expect(page.getByRole('region', { name: russian ? 'Итог диапазона' : 'Range total' })).toContainText('50');
    await page.reload();
    await expect(page.getByRole('region', { name: russian ? 'Итог диапазона' : 'Range total' })).toContainText('50');
    await page.goto('/studio/' + ids.project + '/home?locale=' + (russian ? 'ru-RU' : 'en-US'));
    await page.getByRole('link', { name: 'Home at-risk account', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

