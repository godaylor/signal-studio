import { randomBytes, randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { hashPassword } from '../../src/lib/password';
import prisma from '../../src/lib/prisma';
import { authHeaders, loginPage, loginViaApi, umamiUser } from './helpers';

const ids = { project: randomUUID(), team: randomUUID(), viewer: randomUUID(), session: randomUUID(), visit: randomUUID() };
const viewerName = `lifecycle-viewer-${ids.viewer}`; const password = randomBytes(32).toString('base64url');
const old = new Date('2025-01-01T00:00:00Z');
test.beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.includes('_test_')) throw new Error('Isolated _test_ DB required');
  const owner = await prisma.client.user.findUniqueOrThrow({ where: { username: umamiUser.username }, select: { id: true } });
  await prisma.client.user.create({ data: { id: ids.viewer, username: viewerName, password: hashPassword(password), role: 'user' } });
  await prisma.client.team.create({ data: { id: ids.team, name: 'M16 lifecycle browser' } });
  await prisma.client.teamUser.createMany({ data: [{ userId: owner.id, role: 'team-owner', studioRole: 'owner' }, { userId: ids.viewer, role: 'team-view-only', studioRole: 'viewer' }].map(member => ({ ...member, id: randomUUID(), teamId: ids.team })) });
  await prisma.client.website.create({ data: { id: ids.project, name: 'M16 lifecycle browser', teamId: ids.team } });
  await prisma.client.session.create({ data: { id: ids.session, websiteId: ids.project, createdAt: old } });
  await prisma.client.websiteEvent.create({ data: { id: randomUUID(), websiteId: ids.project, sessionId: ids.session, visitId: ids.visit, createdAt: old, urlPath: '/preserved' } });
  await prisma.client.sessionReplay.create({ data: { id: randomUUID(), websiteId: ids.project, sessionId: ids.session, visitId: ids.visit, createdAt: old, startedAt: old, endedAt: old, events: Buffer.from('[]'), eventCount: 0, chunkIndex: 0 } });
});
test.afterAll(async () => {
  await prisma.client.$executeRaw`DELETE FROM data_lifecycle_job WHERE project_id=${ids.project}::uuid`;
  await prisma.client.securityAuditEvent.deleteMany({ where: { OR: [{ actorUserId: ids.viewer }, { metadata: { path: ['projectId'], equals: ids.project } }] } });
  await prisma.client.sessionReplay.deleteMany({ where: { websiteId: ids.project } });
  await prisma.client.websiteEvent.deleteMany({ where: { websiteId: ids.project } });
  await prisma.client.session.deleteMany({ where: { websiteId: ids.project } });
  await prisma.client.website.deleteMany({ where: { id: ids.project } });
  await prisma.client.teamUser.deleteMany({ where: { teamId: ids.team } });
  await prisma.client.team.deleteMany({ where: { id: ids.team } });
  await prisma.client.user.deleteMany({ where: { id: ids.viewer } });
  await prisma.client.$disconnect();
});
test('lifecycle API denies anonymous, Viewer and foreign target; Viewer has no erasure controls', async ({ request, page }) => {
  const body = { version: 1, idempotencyKey: randomUUID(), confirmProjectId: ids.project, category: 'replay', target: { kind: 'project' }, before: '2026-01-01T00:00:00Z' };
  const url = `/api/projects/${ids.project}/lifecycle`;
  expect((await request.get(url)).status()).toBe(401);
  expect((await request.post(url, { data: body })).status()).toBe(401);
  const viewer = await loginViaApi(request, viewerName, password);
  expect((await request.get(url, { headers: authHeaders(viewer) })).status()).toBe(403);
  expect((await request.post(url, { headers: authHeaders(viewer), data: body })).status()).toBe(403);
  const owner = await loginViaApi(request);
  expect((await request.post(url, { headers: authHeaders(owner), data: { ...body, category: 'all', target: { kind: 'user', id: randomUUID() } } })).status()).toBe(404);
  await page.addInitScript(token => { localStorage.setItem('umami.auth', JSON.stringify(token)); localStorage.setItem('umami.locale', JSON.stringify('en-US')); }, viewer.token);
  await page.goto(`/studio/${ids.project}/settings?locale=en-US`);
  await expect(page.getByRole('heading', { name: 'Insufficient permissions' })).toBeVisible();
  await expect(page.getByText('Data retention and deletion', { exact: true })).toHaveCount(0);
});
test('EN keyboard confirmation → worker physical replay erasure → persisted status; WCAG 2.2 AA', async ({ page, request }) => {
  const auth = await loginPage(page, request);
  await page.goto(`/studio/${ids.project}/settings?locale=en-US`);
  const summary = page.getByText('Data retention and deletion', { exact: true });
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('No deletion requests. Existing data is unchanged.')).toBeVisible();
  const button = page.getByRole('button', { name: 'Delete selected data permanently' });
  await expect(button).toBeDisabled();
  await page.getByLabel('Delete before date (UTC)').fill('2026-01-01');
  await page.getByLabel(/Confirm permanent deletion/).fill(ids.project);
  await expect(button).toBeEnabled();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze(); expect(axe.violations).toEqual([]);
  const queued = page.waitForResponse(response => response.url().endsWith('/lifecycle') && response.request().method()==='POST');
  await button.focus(); await page.keyboard.press('Enter'); expect((await queued).status()).toBe(202);
  await expect.poll(async () => (await request.get(`/api/projects/${ids.project}/lifecycle`, { headers: authHeaders(auth) }).then(r=>r.json())).data[0]?.status, { timeout: 30000 }).toBe('completed');
  expect(await prisma.client.sessionReplay.count({ where: { websiteId: ids.project } })).toBe(0);
  expect(await prisma.client.websiteEvent.count({ where: { websiteId: ids.project } })).toBe(1);
  await page.reload(); await summary.click(); await expect(page.getByRole('cell', { name: 'Completed', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/m16-lifecycle-desktop.png', fullPage: true });
});
test('RU mobile retention and Legal downloads preserve notices, metadata and SBOM', async ({ page, request }) => {
  await loginPage(page, request); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/${ids.project}/settings?locale=ru-RU`);
  await page.getByText('Хранение и удаление данных', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Безвозвратно удалить выбранные данные' })).toBeDisabled();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/m16-lifecycle-mobile.png', fullPage: true });
  await page.goto(`/studio/${ids.project}/legal?locale=ru-RU`);
  await expect(page.getByRole('heading', { name: 'На основе Umami' })).toBeVisible();
  for (const file of ['LICENSE.txt','THIRD_PARTY_NOTICES.md','DEPENDENCY_LICENSES.txt','application.cdx.json','ASSET_PROVENANCE.json','BUILD_METADATA.json']) {
    const result=await request.get(`/legal/${file}`); expect(result.status()).toBe(200);
    if(file==='LICENSE.txt') expect(await result.text()).toContain('Copyright (c) 2022 Umami Software, Inc.');
    if(file==='application.cdx.json') { const bom=await result.json(); expect(bom.bomFormat).toBe('CycloneDX'); expect(bom.components.some(c=>c.name==='ua-parser-js' && c.version==='1.0.41')).toBe(true); expect(bom.components.some(c=>c.name==='ua-parser-js' && c.version.startsWith('2.'))).toBe(false); }
    if(file==='BUILD_METADATA.json') expect((await result.json()).sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  }
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  await page.getByRole('link', { name: 'Исходная лицензия MIT' }).focus(); await expect(page.getByRole('link', { name: 'Исходная лицензия MIT' })).toBeFocused();
});
