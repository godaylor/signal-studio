import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test';
import type { AnalysisQueryV1, AnalysisResult } from '../../src/server/analytics/contracts';
import { serializeAnalysisQuery } from '../../src/server/analytics/url-codec';

type Guest = {
  id: string;
  projectId: string;
  workspaceId: string;
  expiresAt: string;
  defaultQuery: AnalysisQueryV1;
  dataset: { synthetic: boolean; customEvents: number; users: number };
  limits: { exports: number };
};

async function currentGuest(request: APIRequestContext): Promise<Guest> {
  const status = await request.get('/api/guest');
  expect(status.status()).toBe(200);
  expect(status.headers()['cache-control']).toContain('no-store');
  const { guest } = await status.json();
  expect(guest.dataset.synthetic).toBe(true);
  expect(guest.dataset.users).toBe(336);
  return guest;
}

async function startGuest(context: BrowserContext): Promise<Guest> {
  let response = await context.request.post('/api/guest');
  for (let retry = 0; response.status() === 429 && retry < 2; retry++) {
    const seconds = Number(response.headers()['retry-after']);
    // Separate test guests share the real global minute budget. Longer
    // per-client/capacity limits still fail instead of resetting server state.
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 61) break;
    await new Promise(resolve => setTimeout(resolve, seconds * 1000 + 100));
    response = await context.request.post('/api/guest');
  }
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).guest;
}

async function enterGuestThroughUi(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const entry = page.waitForResponse(
      response => response.url().endsWith('/api/guest') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Try without|Попробовать без регистрации/ }).click();
    const response = await entry;
    if (response.status() === 429 && attempt < 2) {
      const seconds = Number(response.headers()['retry-after']);
      // A browser retry owns a fresh guest. Respect the same shared minute
      // budget as the API helper; longer capacity/client limits still fail.
      if (Number.isFinite(seconds) && seconds >= 1 && seconds <= 60) {
        await page.waitForTimeout(seconds * 1000 + 100);
        continue;
      }
    }
    expect(response.status(), await response.text()).toBe(200);
    await expect(page).toHaveURL(/\/studio\/[a-f0-9-]+\/explore\?/, { timeout: 30_000 });
    return;
  }
}

async function query(
  request: APIRequestContext,
  definition: AnalysisQueryV1,
): Promise<AnalysisResult> {
  const response = await request.post(`/api/projects/${definition.projectId}/analytics/query`, {
    data: definition,
  });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.exactness).toBe('exact');
  return result;
}

function converted(result: AnalysisResult) {
  return result.data.rows
    .filter(row => 'kind' in row && row.kind === 'funnel-step')
    .map(row => ('converted' in row ? row.converted : null));
}

async function noOverflowOrBlockingAxe(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);
}

test.afterEach(async ({ page }) => {
  // The opaque cookie identifies only this test's disposable guest session.
  await page.request.delete('/api/guest');
});

test('guest enters the working app, changes a real calculation, persists an Insight and dashboard, and exports', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login?locale=en-US');
  await enterGuestThroughUi(page);
  const guest = await currentGuest(page.request);
  const cookie = (await page.context().cookies()).find(item => item.name === 'signal-studio-guest');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  expect(new Date(guest.expiresAt).getTime()).toBeGreaterThan(Date.now());
  expect(converted(await query(page.request, guest.defaultQuery))).toEqual([336, 252, 168]);
  const table = page.getByRole('table', { name: 'Equivalent funnel data table' });
  await expect(table).toContainText('336');
  await expect(table).toContainText('168');
  await noOverflowOrBlockingAxe(page);

  // Editing the behavior must change SQL results, rather than a scripted demo number.
  await page.getByRole('button', { name: 'Edit query', exact: true }).click();
  await page.getByLabel('Step 3 · value', { exact: true }).fill('subscription_started');
  const recalculated = page.waitForResponse(
    response =>
      response.url().endsWith(`/api/projects/${guest.projectId}/analytics/query`) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  const recalculation = await recalculated;
  expect(recalculation.status()).toBe(200);
  expect(converted(await recalculation.json())).toEqual([336, 252, 84]);
  const appliedUrl = page.url();
  await expect(
    table.getByRole('rowheader', { name: '3. Subscription', exact: true }),
  ).toBeVisible();
  await expect(table).toContainText('84');

  const title = `Guest paid conversion ${randomUUID().slice(0, 8)}`;
  await page.getByRole('button', { name: 'Save insight', exact: true }).click();
  const save = page.getByRole('dialog', { name: 'Save insight', exact: true });
  await save.getByLabel('Insight title').fill(title);
  const saved = page.waitForResponse(
    response =>
      response.url().endsWith(`/api/projects/${guest.projectId}/insights`) &&
      response.request().method() === 'POST',
  );
  await save.getByRole('button', { name: 'Save insight', exact: true }).click();
  const insight = await (await saved).json();
  const library = page.getByRole('dialog', { name: 'Insight library', exact: true });
  await library
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('button', { name: 'Reopen', exact: true })
    .click();
  await page.reload();
  await page.getByRole('button', { name: 'Edit query', exact: true }).click();
  await expect(page.getByLabel('Step 3 · value', { exact: true })).toHaveValue(
    'subscription_started',
  );
  await page.keyboard.press('Escape');
  await expect(table).toContainText('84');
  await page.getByRole('button', { name: 'Insight library', exact: true }).click();
  await expect(library.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect((await currentGuest(page.request)).id).toBe(guest.id);
  const resumed = await page.request.post('/api/guest');
  expect((await resumed.json()).guest.id).toBe(guest.id);

  await page.goto(`/studio/${guest.projectId}/dashboards?locale=en-US`);
  const dashboardTitle = `Guest decisions ${randomUUID().slice(0, 8)}`;
  await page.getByRole('button', { name: 'New dashboard', exact: true }).click();
  await page.getByLabel('New dashboard title').fill(dashboardTitle);
  const created = page.waitForResponse(
    response =>
      response.url().endsWith(`/api/projects/${guest.projectId}/dashboards`) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create dashboard', exact: true }).click();
  const dashboard = await (await created).json();
  await page.getByLabel('Insight to add').selectOption(insight.id);
  await page.getByRole('button', { name: 'Add Insight', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Project dashboards' })
    .getByRole('button', { name: new RegExp(dashboardTitle) })
    .click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const storedDashboard = await page.request.get(
    `/api/projects/${guest.projectId}/dashboards/${dashboard.id}`,
  );
  expect((await storedDashboard.json()).widgets).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: 'insight', insightId: insight.id })]),
  );

  await page.goto(appliedUrl);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export data', exact: true });
  await exportDialog.getByLabel('File format').selectOption('json');
  const downloading = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Export data', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toContain('funnel-');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.metadata.exactness).toBe('exact');
  expect(exported.metadata.definition.source.query.funnel.steps[2].value).toBe(
    'subscription_started',
  );
  expect(
    exported.rows
      .filter((row: { kind?: string }) => row.kind === 'funnel-step')
      .map((row: { converted: number }) => row.converted),
  ).toEqual([336, 252, 84]);
  await page.keyboard.press('Escape');

  // An independent browser gets a different server principal, tenant, and dataset IDs.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const second = await startGuest(other);
    expect(second.projectId).not.toBe(guest.projectId);
    expect(second.workspaceId).not.toBe(guest.workspaceId);
    for (const resource of [
      `/api/projects/${guest.projectId}`,
      `/api/projects/${guest.projectId}/insights/${insight.id}`,
      `/api/projects/${guest.projectId}/dashboards/${dashboard.id}`,
    ])
      expect((await other.request.get(resource)).status()).toBe(403);
    expect(
      (
        await other.request.post(`/api/projects/${guest.projectId}/analytics/query`, {
          data: guest.defaultQuery,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await other.request.post(`/api/projects/${guest.projectId}/exports`, {
          data: {
            version: 1,
            source: { kind: 'analysis', query: guest.defaultQuery },
            format: 'json',
            allRows: false,
            idempotencyKey: randomUUID(),
          },
        })
      ).status(),
    ).toBe(403);
    const own = await other.request.get(`/api/projects/${second.projectId}/insights`);
    expect(JSON.stringify(await own.json())).not.toContain(title);
    expect(converted(await query(other.request, second.defaultQuery))).toEqual([336, 252, 168]);
    expect(
      (
        await other.request.post('/api/users', {
          data: {
            username: `forbidden-${randomUUID()}`,
            password: 'Forbidden-test-user-1',
            role: 'user',
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await other.request.post('/api/guest', { headers: { origin: 'https://unrelated.example' } })
      ).status(),
    ).toBe(403);

    // The real export budget is server enforced even if the UI is bypassed.
    for (let index = 0; index < second.limits.exports; index++) {
      const response = await other.request.post(`/api/projects/${second.projectId}/exports`, {
        data: {
          version: 1,
          source: { kind: 'analysis', query: second.defaultQuery },
          format: 'json',
          allRows: false,
          idempotencyKey: randomUUID(),
        },
      });
      expect(response.status(), await response.text()).toBe(200);
    }
    const limited = await other.request.post(`/api/projects/${second.projectId}/exports`, {
      data: {
        version: 1,
        source: { kind: 'analysis', query: second.defaultQuery },
        format: 'json',
        allRows: false,
        idempotencyKey: randomUUID(),
      },
    });
    expect(limited.status()).toBe(429);
    expect((await limited.json()).error.code).toBe('guest-resource-limit');
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);

    // Replay a formerly valid cookie after explicit expiry; the live record must deny it.
    const oldCookies = await other.cookies();
    expect((await other.request.delete('/api/guest')).status()).toBe(200);
    await other.addCookies(oldCookies);
    expect((await other.request.post('/api/auth/verify')).status()).toBe(401);
    expect((await other.request.get(`/api/projects/${second.projectId}/insights`)).status()).toBe(
      401,
    );
    expect((await other.request.get('/api/guest')).status()).toBe(200);
    expect((await (await other.request.get('/api/guest')).json()).guest).toBeNull();
  } finally {
    await other.request.delete('/api/guest');
    await other.close();
  }
  await page.request.delete('/api/guest');
});

test('guest mobile has accessible navigation and forms, explains synthetic data, and recovers from analysis failure', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const guest = await startGuest(page.context());
  const path = `/studio/${guest.projectId}/explore?${serializeAnalysisQuery(guest.defaultQuery)}&locale=ru-RU`;
  await page.goto(path);
  await expect(
    page.getByRole('table', { name: 'Эквивалентная таблица данных воронки' }),
  ).toContainText('168');
  await expect(
    page.getByRole('button', { name: 'Синтетические данные', exact: true }),
  ).toBeVisible();
  await noOverflowOrBlockingAxe(page);
  await page.getByRole('button', { name: 'Изменить запрос', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Изменить запрос', exact: true });
  await editor.getByLabel('Шаг 3 · значение', { exact: true }).fill('subscription_started');
  await noOverflowOrBlockingAxe(page);
  await editor.getByRole('button', { name: 'Выполнить анализ', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Эквивалентная таблица данных воронки' }),
  ).toContainText('84');
  await page.getByRole('button', { name: 'Сохранить анализ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Сохранить анализ', exact: true });
  await dialog.getByLabel('Название анализа').fill(`Мобильный анализ ${randomUUID().slice(0, 8)}`);
  await noOverflowOrBlockingAxe(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить анализ', exact: true })).toBeFocused();

  const endpoint = `**/api/projects/${guest.projectId}/analytics/query`;
  await page.route(endpoint, route =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'analysis-unavailable', message: 'Temporarily unavailable' },
      }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Анализ завершился ошибкой', exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Изменить запрос', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.unroute(endpoint);
  await page.reload();
  await expect(
    page.getByRole('table', { name: 'Эквивалентная таблица данных воронки' }),
  ).toContainText('84');
  expect((await currentGuest(page.request)).id).toBe(guest.id);
  await page.getByRole('button', { name: 'Включить тёмную тему', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Эквивалентная таблица данных воронки' })).toHaveCSS(
    'color',
    'rgb(233, 247, 253)',
  );
  await noOverflowOrBlockingAxe(page);
  await page.setViewportSize({ width: 834, height: 1112 });
  const navigationTrigger = page
    .getByRole('button', { name: 'Открыть навигацию', exact: true })
    .first();
  await navigationTrigger.click();
  const navigation = page.getByRole('dialog', { name: 'Кинорит', exact: true });
  for (const name of ['Главная', 'Анализ', 'Дашборды', 'Аудитории', 'Опыт', 'Сейчас']) {
    await expect(navigation.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await noOverflowOrBlockingAxe(page);
  await page.keyboard.press('Escape');
  await expect(navigationTrigger).toBeFocused();
  await page.request.delete('/api/guest');
});

test('a forged guest cookie cannot authenticate or read a project', async ({ context }) => {
  const baseURL = String(test.info().project.use.baseURL);
  await context.addCookies([
    {
      name: 'signal-studio-guest',
      value: 'a'.repeat(64),
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  expect((await context.request.post('/api/auth/verify')).status()).toBe(401);
  expect((await (await context.request.get('/api/guest')).json()).guest).toBeNull();
  expect((await context.request.get(`/api/projects/${randomUUID()}`)).status()).toBe(401);
});
