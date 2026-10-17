import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`Russian optical workspace: ${mobile ? 'mobile with reduced motion' : 'desktop with visible motion'}`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: mobile ? 'reduce' : 'no-preference' });
    await page.goto('/login?locale=ru-RU');
    await expect(page).toHaveTitle(/Яснослед/);
    await expect(page.locator('html')).toHaveAttribute('data-visual-motion', mobile ? 'off' : 'on');
    if (!mobile) {
      const trace = page.locator('[data-ambient] path').last();
      const before = await trace.evaluate(el => getComputedStyle(el).strokeDashoffset);
      await expect
        .poll(() => trace.evaluate(el => getComputedStyle(el).strokeDashoffset))
        .not.toBe(before);
      await page.getByRole('button', { name: 'Приостановить анимацию', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'off');
      await expect(page.locator('[data-ambient]')).toHaveAttribute('data-active', 'false');
      await page.getByRole('button', { name: 'Включить анимацию', exact: true }).click();
    }
    // Entry itself is covered by the guest/auth suites; respect the real global entry budget.
    let entry = await page.request.post('/api/guest');
    for (let retry = 0; entry.status() === 429 && retry < 2; retry++) {
      const seconds = Number(entry.headers()['retry-after']);
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 61) break;
      await page.waitForTimeout(seconds * 1000 + 100);
      entry = await page.request.post('/api/guest');
    }
    expect(entry.status(), await entry.text()).toBe(200);
    const { guest } = await entry.json();
    try {
      for (const theme of ['light', 'dark']) {
        for (const section of [
          'home',
          'explore',
          'dashboards',
          'audiences',
          'experience',
          'live',
        ]) {
          await page.goto(`/studio/${guest.projectId}/${section}?locale=ru-RU`);
          const themeButton = page.getByRole('button', {
            name: theme === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему',
            exact: true,
          });
          await page.getByRole('button', { name: /Включить (тёмную|светлую) тему/ }).waitFor();
          if (await themeButton.count()) await themeButton.click();
          await expect(page.getByRole('heading', { level: 1 }).last()).toBeVisible();
          await expect(page.locator('[data-variant="loading"]')).toHaveCount(0);
          if (section === 'home') {
            await expect
              .poll(() =>
                page
                  .locator('[data-stage="retention"]')
                  .evaluate(el => getComputedStyle(el).opacity),
              )
              .toBe('1');
          }
          if (section === 'explore') {
            const answer = page.getByRole('region', { name: 'Итог диапазона', exact: true });
            await expect(answer).toContainText('168');
            await expect(answer).toContainText('50');
            const table = page.getByRole('table', { name: 'Эквивалентная таблица данных воронки' });
            await expect(table).toContainText('336');
            if (mobile) {
              const box = await answer.boundingBox();
              if (!box) throw new Error('The analytical answer must be visible on mobile');
              expect(box.y + box.height).toBeLessThan(780);
            }
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(
            axe.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')),
          ).toEqual([]);
        }
      }
      await page.goto(`/studio/${guest.projectId}/explore?locale=ru-RU`);
      const edit = page.getByRole('button', { name: 'Изменить запрос', exact: true });
      await edit.click();
      const dialog = page.getByRole('dialog', { name: 'Изменить запрос', exact: true });
      await expect(dialog).toBeFocused();
      if (mobile) {
        const trace = page.locator('[data-ambient] path').last();
        const before = await trace.evaluate(el => getComputedStyle(el).strokeDashoffset);
        await page.waitForTimeout(180);
        expect(await trace.evaluate(el => getComputedStyle(el).strokeDashoffset)).toBe(before);
      }
      await page.keyboard.press('Escape');
      await expect(edit).toBeFocused();
    } finally {
      await page.request.delete('/api/guest');
    }
  });
}
