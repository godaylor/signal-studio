import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { serializeAnalysisQuery } from '../../src/server/analytics/url-codec';
import type { AnalysisQueryV1 } from '../../src/server/analytics/contracts';
import { authHeaders, loginPage, loginViaApi } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const query: AnalysisQueryV1 = { version: 1, projectId, mode: 'trend', range: { startAt: '2026-03-01T00:00:00.000Z', endAt: '2026-03-15T00:00:00.000Z', timezone: 'UTC', unit: 'day' }, measure: { source: 'event', key: 'signup', aggregation: 'count' }, filters: [], match: 'all', comparison: 'none', visualization: 'line' };

test('export API requires authentication and rejects cross-project definitions', async ({ request }) => {
  const definition = { version: 1, source: { kind: 'analysis', query }, format: 'json', allRows: false, idempotencyKey: randomUUID() };
  expect((await request.post(`/api/projects/${projectId}/exports`, { data: definition })).status()).toBe(401);
  const auth = await loginViaApi(request);
  const response = await request.post(`/api/projects/${projectId}/exports`, { headers: authHeaders(auth), data: { ...definition, source: { kind: 'analysis', query: { ...query, projectId: randomUUID() } } } });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe('export-project-mismatch');
});

for (const russian of [false, true]) {
  test(`Explore ${russian ? 'RU mobile' : 'EN desktop'} exports applied query as JSON`, async ({ page, request }) => {
    await loginPage(page, request);
    await page.addInitScript(locale => { localStorage.setItem('umami.locale', JSON.stringify(locale)); }, russian ? 'ru-RU' : 'en-US');
    if (russian) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/studio/${projectId}/explore?${serializeAnalysisQuery(query)}&locale=${russian ? 'ru-RU' : 'en-US'}`);
    const trigger = page.getByRole('button', { name: russian ? 'Экспорт' : 'Export', exact: true });
    await expect(trigger).toBeEnabled(); await trigger.click();
    const dialog = page.getByRole('dialog', { name: russian ? 'Экспорт данных' : 'Export data', exact: true });
    await expect(dialog).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: `.local/m15-export-${russian ? 'ru-mobile' : 'en-desktop'}.png`, fullPage: true });
    await dialog.getByRole('combobox', { name: russian ? 'Формат файла' : 'File format' }).selectOption('json');
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('button', { name: russian ? 'Экспортировать данные' : 'Export data', exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toContain('trend-2026-03-01_2026-03-15.json');
    const stream = await download.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const content = JSON.parse(Buffer.concat(chunks).toString());
    expect(content.metadata.definition.source.query).toEqual(query);
    expect(content.metadata.exactness).toBe('exact');
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('all matching audiences queue and become a downloadable expiring artifact', async ({ page, request }) => {
  const auth = await loginPage(page, request);
  await page.goto(`/studio/${projectId}/audiences?locale=en-US`);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export data', exact: true });
  await dialog.getByRole('checkbox', { name: 'All matching rows' }).check();
  const queued = page.waitForResponse(response => response.url().endsWith(`/api/projects/${projectId}/exports`) && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Export data', exact: true }).click();
  const response = await queued; expect(response.status()).toBe(202);
  const job = (await response.json()).data;
  await expect.poll(async () => { const response = await request.get(`/api/projects/${projectId}/exports`, { headers: authHeaders(auth) }); return (await response.json()).data.find(item => item.id === job.id)?.status; }, { timeout: 30_000 }).toBe('completed');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: `Download ${job.filename}`, exact: true }).first().click();
  expect((await download).suggestedFilename()).toBe(job.filename);
});
