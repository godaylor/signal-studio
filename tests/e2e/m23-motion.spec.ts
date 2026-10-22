import { expect, type Locator, test } from '@playwright/test';

test('guest entry becomes available only after its real scripts load', async ({ page }) => {
  let release = () => {};
  const scriptsReady = new Promise<void>(resolve => {
    release = resolve;
  });
  let delayed = 0;
  await page.route('**/_next/static/chunks/**', async route => {
    if (route.request().resourceType() === 'script') {
      delayed++;
      await scriptsReady;
    }
    await route.continue();
  });
  try {
    await page.goto('/login?locale=ru-RU', { waitUntil: 'commit' });
    const entry = page.getByRole('button', { name: 'Попробовать без регистрации', exact: true });
    await expect(entry).toBeVisible();
    await expect.poll(() => delayed).toBeGreaterThan(0);
    await expect(entry).toBeDisabled();
    await expect(entry).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(entry).toBeEnabled({ timeout: 30_000 });
    await expect(entry).not.toHaveAttribute('aria-busy', 'true');
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

async function offset(pulse: Locator) {
  return pulse.evaluate(element => getComputedStyle(element).strokeDashoffset);
}

async function expectStill(pulse: Locator) {
  const before = await offset(pulse);
  await pulse.page().waitForTimeout(220);
  expect(await offset(pulse)).toBe(before);
}

test('a stored pause is respected on entry, survives reload and keeps the example interactive', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('yasnosled.motion', 'off'));
  await page.goto('/login?locale=ru-RU');
  await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'off');
  const field = page.locator('[data-ambient]').first();
  const pulse = field.locator('[data-flow-pulse]').first();
  await expect(field).toHaveAttribute('data-active', 'false');
  await expectStill(pulse);
  expect(
    await field.evaluate(
      element =>
        element
          .getAnimations({ subtree: true })
          .filter(animation => animation.playState === 'running').length,
    ),
  ).toBe(0);

  const shapes = page.locator('[data-flow-body]');
  const before = await shapes.evaluateAll(elements =>
    elements.map(element => element.getAttribute('d')),
  );
  await page
    .getByRole('group', { name: 'Цель примера', exact: true })
    .getByRole('button', { name: 'Подписка', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Оформили подписку: 84', exact: true }),
  ).toBeVisible();
  expect(
    await shapes.evaluateAll(elements => elements.map(element => element.getAttribute('d'))),
  ).not.toEqual(before);
  await expectStill(pulse);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'off');
  await expect(page.getByRole('button', { name: 'Включить анимацию', exact: true })).toBeVisible();
  await expectStill(pulse);
});

test('changing the OS preference immediately stops actual motion and preserves the manual pause', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/login?locale=ru-RU');
  const pulse = page.locator('[data-flow-pulse]').first();
  const shapes = page.locator('[data-flow-body]');
  await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'on');
  const initial = await offset(pulse);
  await expect.poll(() => offset(pulse)).not.toBe(initial);
  const before = await shapes.evaluateAll(elements =>
    elements.map(element => element.getAttribute('d')),
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'off');
  await expectStill(pulse);
  expect(await pulse.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  expect(
    await shapes.evaluateAll(elements => elements.map(element => element.getAttribute('d'))),
  ).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Использовали функцию: 168', exact: true }),
  ).toBeVisible();

  // A manual pause remains authoritative when the OS subsequently allows motion.
  await page.getByRole('button', { name: 'Приостановить анимацию', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'off');
  await expectStill(pulse);
  await page.getByRole('button', { name: 'Включить анимацию', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-visual-motion', 'on');
  const resumed = await offset(pulse);
  await expect.poll(() => offset(pulse)).not.toBe(resumed);
});
