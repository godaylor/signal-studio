import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { authHeaders, loginPage } from './helpers';

const output = '.local/product-gallery';

test('capture the real product on desktop and mobile', async ({ page, request }) => {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login?locale=en-US');
  await expect(page.getByRole('heading', { name: 'Signal Studio', exact: true })).toBeVisible();
  await page.screenshot({ path: `${output}/login-desktop.png` });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  const auth = await loginPage(page, request);
  const response = await request.get('/api/websites?includeTeams=1', { headers: authHeaders(auth) });
  const projects = (await response.json()).data;
  const project = projects.find(item => item.name === 'Portfolio · Activation Lab');
  expect(project).toBeTruthy();
  await page.goto(`/studio/${project.id}/home?locale=en-US`);
  await expect(page.getByRole('link', { name: 'Open definition in Explore', exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${output}/home-desktop.png` });
  await page.getByRole('link', { name: 'Open definition in Explore', exact: true }).first().click();
  await expect(page.getByRole('region', { name: 'Range total' })).toBeVisible();
  await page.screenshot({ path: `${output}/explore-desktop.png` });
  await page.goto(`/studio/${project.id}/sources?locale=en-US`);
  await expect(page.getByRole('textbox', { name: 'Tracking snippet' })).not.toHaveValue('');
  await page.screenshot({ path: `${output}/sources-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/${project.id}/home?locale=ru-RU`);
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть определение в анализе', exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${output}/home-mobile-ru.png` });
});
