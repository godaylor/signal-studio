import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loginPage } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const studioHome = `/studio/${projectId}/home`;
const primaryLabels = ['Home', 'Explore', 'Dashboards', 'Audiences', 'Experience', 'Live'];
const evidenceDir = resolve(process.cwd(), 'docs/evidence/m3');

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
});

test.beforeEach(async ({ page, request }) => {
  await loginPage(page, request);
});

test('desktop shell exposes the product IA and light visual contract', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioHome);

  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  const desktopNav = page.locator('aside').getByRole('navigation', { name: 'Primary' });
  await expect(desktopNav.getByRole('link')).toHaveText(primaryLabels);
  await expect(desktopNav.getByRole('link', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('link', { name: 'Based on Umami · MIT' })).toBeVisible();

  await page.screenshot({ path: resolve(evidenceDir, 'studio-desktop-light.png'), fullPage: true });
  await expect(page).toHaveScreenshot('studio-desktop-light.png', { fullPage: true });
});

test('desktop command palette is bounded and restores focus in dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioHome);

  const themeToggle = page.getByRole('button', { name: 'Switch to dark theme' });
  await themeToggle.click();
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();

  const paletteTrigger = page.getByRole('button', { name: 'Open command palette' });
  await paletteTrigger.focus();
  await paletteTrigger.click();
  const palette = page.getByRole('dialog', { name: 'Go to' });
  await expect(palette).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search Studio pages' })).toBeFocused();
  await expect(palette.getByRole('option')).toHaveCount(primaryLabels.length);

  await page.screenshot({ path: resolve(evidenceDir, 'studio-desktop-dark-command.png') });
  await expect(page).toHaveScreenshot('studio-desktop-dark-command.png');

  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(paletteTrigger).toBeFocused();
});

test('tablet navigation keeps all primary destinations and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto(studioHome);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'Signal Studio' });
  const drawerNav = drawer.getByRole('navigation', { name: 'Primary' });
  await expect(drawerNav.getByRole('link')).toHaveText(primaryLabels);

  await page.screenshot({ path: resolve(evidenceDir, 'studio-tablet-navigation.png') });
  await expect(page).toHaveScreenshot('studio-tablet-navigation.png');

  await drawerNav.getByRole('link', { name: 'Explore' }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/studio/${projectId}/explore$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Explore' })).toBeVisible();
});

test('mobile shell honors reduced motion and preserves the same IA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto(studioHome);

  await expect
    .poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
    .toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'Signal Studio' });
  await expect(drawer.getByRole('navigation', { name: 'Primary' }).getByRole('link')).toHaveText(
    primaryLabels,
  );

  const duplicateIds = await page.locator('[id]').evaluateAll(elements => {
    const ids = elements.map(element => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);

  await page.screenshot({ path: resolve(evidenceDir, 'studio-mobile-reduced-motion.png') });
  await expect(page).toHaveScreenshot('studio-mobile-reduced-motion.png');
});

test('unknown project returns a permission state without project content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/00000000-0000-4000-8000-000000000000/home');

  await expect(page.getByRole('heading', { name: 'Project access is unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose an available project' })).toBeVisible();
  await expect(page.getByText('Signal Studio Demo')).toHaveCount(0);
});
