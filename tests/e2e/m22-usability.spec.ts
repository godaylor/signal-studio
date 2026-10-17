import { type BrowserContext, test as base, expect } from '@playwright/test';
import type { AnalysisQueryV1 } from '../../src/server/analytics/contracts';
import { serializeAnalysisQuery } from '../../src/server/analytics/url-codec';

type Guest = { projectId: string; defaultQuery: AnalysisQueryV1 };
type GuestSession = { context: BrowserContext; guest: Guest };

// All cases share one disposable worker-owned guest. Local review can instead
// reuse its existing isolated session without creating or revoking any guest.
const test = base.extend<Record<never, never>, { guestSession: GuestSession }>({
  guestSession: [
    async ({ browser }, use, workerInfo) => {
      const existingState = process.env.M22_EXISTING_GUEST_STATE;
      const context = await browser.newContext({
        baseURL: String(workerInfo.project.use.baseURL),
        storageState: existingState,
        reducedMotion: 'reduce',
      });
      try {
        let response = existingState
          ? await context.request.get('/api/guest')
          : await context.request.post('/api/guest');
        for (let retry = 0; !existingState && response.status() === 429 && retry < 2; retry++) {
          const seconds = Number(response.headers()['retry-after']);
          if (!Number.isFinite(seconds) || seconds < 1 || seconds > 61) break;
          await new Promise(resolve => setTimeout(resolve, seconds * 1000 + 100));
          response = await context.request.post('/api/guest');
        }
        expect(response.status(), await response.text()).toBe(200);
        const { guest } = await response.json();
        expect(guest, 'The supplied local guest must still be valid.').toBeTruthy();
        await use({ context, guest });
      } finally {
        if (!existingState) await context.request.delete('/api/guest');
        await context.close();
      }
    },
    { scope: 'worker' },
  ],
  context: async ({ guestSession }, use) => {
    await use(guestSession.context);
  },
});

function explorePath(guest: Guest) {
  return `/studio/${guest.projectId}/explore?${serializeAnalysisQuery(guest.defaultQuery)}&locale=en-US`;
}

test('rapid analysis type changes never render the previous result as the new question', async ({
  page,
  guestSession: { guest },
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(explorePath(guest));
  const funnel = page.getByRole('table', { name: 'Equivalent funnel data table', exact: true });
  await expect(funnel).toContainText('168');

  const requested: string[] = [];
  let release = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const endpoint = `**/api/projects/${guest.projectId}/analytics/query`;
  await page.route(endpoint, async route => {
    requested.push(route.request().postDataJSON().mode);
    await held;
    // Superseded requests are expected to be aborted by TanStack Query.
    await route.continue().catch(() => undefined);
  });
  try {
    for (const [mode, name] of [
      ['trend', 'Trend'],
      ['breakdown', 'Breakdown'],
      ['retention', 'Retention'],
    ] as const) {
      await page
        .getByRole('group', { name: 'Analysis type', exact: true })
        .getByRole('button', { name, exact: true })
        .click();
      await expect.poll(() => requested.includes(mode)).toBe(true);
      await expect(page).toHaveURL(new RegExp(`mode=${mode}`));
      await expect(
        page.getByRole('heading', { name: 'Calculating your answer', exact: true }),
      ).toBeVisible();
      await expect(funnel).toHaveCount(0);
      await expect(page.locator('[data-variant="error"]')).toHaveCount(0);
    }
    release();
    const retention = page.getByRole('table', { name: /Retention matrix/ });
    await expect(retention).toBeVisible();
    await expect(retention).toContainText('Not observed');
    await expect(page.locator('[data-variant="error"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    release();
    await page.unroute(endpoint);
  }
});

test('the device question computes real segment rates and running the same question refetches', async ({
  page,
  guestSession: { guest },
}) => {
  await page.goto(explorePath(guest));
  await expect(
    page.getByRole('table', { name: 'Equivalent funnel data table', exact: true }),
  ).toContainText('168');
  const endpoint = `/api/projects/${guest.projectId}/analytics/query`;
  const calculation = page.waitForResponse(
    response =>
      response.url().endsWith(endpoint) &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON().breakdown?.field === 'device',
  );
  await page
    .getByRole('complementary', { name: 'Sample questions', exact: true })
    .getByRole('button', { name: 'Phone or computer?', exact: true })
    .click();
  const result = await calculation;
  expect(result.status()).toBe(200);
  const payload = await result.json();
  const finalSteps = payload.data.rows.filter(
    (row: { kind?: string; step?: number }) => row.kind === 'funnel-step' && row.step === 3,
  );
  expect(finalSteps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ segment: 'desktop', converted: 126, overallConversionRate: 0.75 }),
      expect.objectContaining({ segment: 'mobile', converted: 42, overallConversionRate: 0.25 }),
    ]),
  );
  const table = page.getByRole('table', { name: 'Equivalent funnel data table', exact: true });
  await expect(table.getByRole('row').filter({ hasText: /desktop · 3\./ })).toContainText('75.0%');
  await expect(table.getByRole('row').filter({ hasText: /mobile · 3\./ })).toContainText('25.0%');

  await page.getByRole('button', { name: 'Edit query', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit query', exact: true });
  const before = page.url();
  const refresh = page.waitForResponse(
    response => response.url().endsWith(endpoint) && response.request().method() === 'POST',
  );
  await editor.getByRole('button', { name: 'Run analysis', exact: true }).click();
  const refreshed = await refresh;
  expect(refreshed.status()).toBe(200);
  expect(refreshed.request().postDataJSON().breakdown).toMatchObject({ field: 'device' });
  expect(page.url()).toBe(before);
  await expect(table.getByRole('row').filter({ hasText: /desktop · 3\./ })).toContainText('75.0%');
});

test('mobile editing covers the shell, preserves valid dates and recovers from clipboard denial', async ({
  page,
  guestSession: { guest },
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
    });
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(explorePath(guest));
  await expect(
    page.getByRole('table', { name: 'Equivalent funnel data table', exact: true }),
  ).toContainText('168');
  const edit = page.getByRole('button', { name: 'Edit query', exact: true });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await edit.click();
    const dialog = page.getByRole('dialog', { name: 'Edit query', exact: true });
    await expect(dialog).toBeFocused();
    // Focus can arrive before the entrance transition finishes. Require the
    // actual final viewport bounds rather than measuring an intermediate frame.
    await expect(async () => {
      const box = await dialog.boundingBox();
      if (!box) throw new Error('The mobile query editor must occupy the viewport.');
      expect(box.x).toBeCloseTo(0, 0);
      expect(box.y).toBeCloseTo(0, 0);
      expect(box.width).toBeCloseTo(viewport.width, 0);
      expect(box.height).toBeCloseTo(viewport.height, 0);
    }).toPass({ timeout: 5000, intervals: [50, 100, 200] });
    const title = dialog.getByRole('heading', { name: 'Edit query', exact: true });
    await expect(title).toBeVisible();
    expect(
      await title.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return element === hit || element.contains(hit);
      }),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(edit).toBeFocused();
  }

  await edit.click();
  const editor = page.getByRole('dialog', { name: 'Edit query', exact: true });
  await editor.getByRole('button', { name: /Context/ }).click();
  const date = editor.getByLabel('Start date', { exact: true });
  const previousDate = await date.inputValue();
  const appliedUrl = page.url();
  await date.fill('');
  await expect(date).toHaveValue(previousDate);
  await expect(editor.getByRole('alert')).toContainText('previous date has been kept');
  expect(page.url()).toBe(appliedUrl);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Copy URL', exact: true }).click();
  const copyFailure = page.getByRole('alert').filter({ hasText: 'Copying is unavailable.' });
  await expect(copyFailure).toContainText('Select and copy the address in your browser');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    }),
  );
  await page.getByRole('button', { name: 'Copy URL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'URL copied', exact: true })).toBeVisible();
  await expect(copyFailure).toHaveCount(0);
  expect(errors).toEqual([]);
});
