import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Manual only: temporary scoped non-admin credentials, never the administrator.
const fixture = JSON.parse(process.env.PRODUCTION_ACCEPTANCE_CREDENTIALS || '{}');
test.skip(!fixture.username?.startsWith('acceptance-'), 'Requires scoped production fixture');

test('production source, Explore, saved analysis, dashboard, audience and download', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login?locale=en-US');
  await page.getByTestId('input-username').locator('input').fill(fixture.username);
  await page.getByTestId('input-password').locator('input').fill(fixture.password);
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login'));
  await page.getByTestId('button-submit').click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/studio/, { timeout: 30_000 });
  await page.goto(`/studio/${fixture.projectId}/sources?locale=en-US`);
  await expect(page.getByRole('textbox', { name: 'Tracking snippet' })).toHaveValue(new RegExp(fixture.projectId));
  await expect(page.getByText('Your source is receiving events', { exact: true })).toBeVisible();
  const query = new URLSearchParams({ aqv: '1', project: fixture.projectId, mode: 'trend', event: 'production_acceptance', aggregation: 'count', start: new Date(Date.now() - 3600000).toISOString(), end: new Date(Date.now() + 60000).toISOString(), tz: 'UTC', unit: 'day', compare: 'none', view: 'table', match: 'all', locale: 'en-US' });
  await page.goto(`/studio/${fixture.projectId}/explore?${query}`);
  await expect(page.getByRole('heading', { name: 'production_acceptance', exact: true })).toBeVisible();
  const title = `Browser acceptance ${randomUUID().slice(0, 8)}`;
  await page.getByRole('button', { name: 'Save insight', exact: true }).click();
  const save = page.getByRole('dialog', { name: 'Save insight', exact: true });
  await save.getByLabel('Insight title').fill(title);
  await save.getByRole('button', { name: 'Save insight', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Insight library' });
  await library.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: 'Reopen' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'production_acceptance', exact: true })).toBeVisible();
  await page.goto(`/studio/${fixture.projectId}/dashboards?locale=en-US`);
  await expect(page.getByText('Production acceptance dashboard', { exact: true }).first()).toBeVisible();
  await page.goto(`/studio/${fixture.projectId}/audiences?entity=user&locale=en-US`);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export data', exact: true });
  await dialog.getByRole('combobox', { name: 'File format' }).selectOption('json');
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export data', exact: true }).click();
  const download = await pending;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).rows).toHaveLength(1);
  await page.screenshot({ path: '.local/evidence/production-audience-export.png' });
});
