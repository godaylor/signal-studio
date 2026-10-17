import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function settleTheme(page: import('@playwright/test').Page) {
  // Audit the actual final palette, while separately testing motion above.
  // Infinite decorative traces are deliberately allowed to keep running.
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(
      document
        .getAnimations()
        .filter(
          animation =>
            animation.playState === 'running' &&
            Number.isFinite(animation.effect?.getTiming().iterations ?? 1),
        )
        .map(animation => animation.finished.catch(() => undefined)),
    );
  });
}

for (const mobile of [false, true]) {
  test(`Russian data workspace: ${mobile ? 'mobile with reduced motion' : 'desktop with visible motion'}`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: mobile ? 'reduce' : 'no-preference' });
    await page.goto('/login?locale=ru-RU');
    await expect(page).toHaveTitle(/Кинорит/);
    await expect(page.locator('html')).toHaveAttribute('data-visual-motion', mobile ? 'off' : 'on');
    const entryAudit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      entryAudit.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')),
    ).toEqual([]);
    const shape = page.locator('[data-flow-body]').last();
    const beforeShape = await shape.getAttribute('d');
    if (!beforeShape) throw new Error('The example must render an aggregate flow');
    await page
      .getByRole('group', { name: 'Цель примера' })
      .getByRole('button', { name: 'Подписка', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Подписка: 84', exact: true })).toBeVisible();
    await expect(shape).not.toHaveAttribute('d', beforeShape);
    await page
      .getByRole('group', { name: 'Цель примера' })
      .getByRole('button', { name: 'Активация', exact: true })
      .click();
    if (!mobile) {
      const trace = page.locator('[data-flow-pulse]').first();
      const before = await trace.evaluate(el => getComputedStyle(el).strokeDashoffset);
      await expect
        .poll(() => trace.evaluate(el => getComputedStyle(el).strokeDashoffset))
        .not.toBe(before);
      await page.getByRole('button', { name: 'Приостановить анимацию', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'off');
      await expect(page.locator('[data-ambient]')).toHaveAttribute('data-active', 'false');
      await page.getByRole('button', { name: 'Включить анимацию', exact: true }).click();
      await page.getByRole('link', { name: 'Войти', exact: true }).click();
      await expect(page.locator('[data-ambient]')).toHaveAttribute('data-active', 'false');
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('[data-ambient]')).toHaveAttribute('data-active', 'true');
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
          await expect(page.locator('[data-variant="loading"]')).toHaveCount(0, {
            timeout: 30_000,
          });
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
          await settleTheme(page);
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
        const trace = page.locator('[data-flow-pulse]').first();
        const before = await trace.evaluate(el => getComputedStyle(el).strokeDashoffset);
        await page.waitForTimeout(180);
        expect(await trace.evaluate(el => getComputedStyle(el).strokeDashoffset)).toBe(before);
      }
      await page.keyboard.press('Escape');
      await expect(edit).toBeFocused();
      if (mobile) {
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto('/login?locale=ru-RU');
        const signIn = await page.getByRole('link', { name: 'Войти', exact: true }).boundingBox();
        if (!signIn) throw new Error('Sign in must remain reachable at 320px');
        expect(signIn.x).toBeGreaterThanOrEqual(0);
        expect(signIn.x + signIn.width).toBeLessThanOrEqual(320);
        await page.goto(`/studio/${guest.projectId}/home?locale=ru-RU`);
        await expect(page.locator('[data-stage="retention"]')).toBeVisible({ timeout: 30_000 });
        const journey = page.getByRole('link', { name: 'Исследовать путь', exact: true });
        const rate = page
          .getByRole('main')
          .locator('header')
          .first()
          .getByText('50 %', { exact: true });
        const answerBox = await rate.boundingBox();
        const actionBox = await journey.boundingBox();
        if (!answerBox || !actionBox) throw new Error('The answer and action must be visible');
        expect(answerBox.y + answerBox.height).toBeLessThanOrEqual(actionBox.y);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
    } finally {
      await page.request.delete('/api/guest');
    }
  });
}
