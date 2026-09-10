import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { loginPage } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';

function funnelUrl() {
  const params = new URLSearchParams([
    ['aqv', '1'],
    ['project', projectId],
    ['mode', 'funnel'],
    ['event', 'signup'],
    ['aggregation', 'count'],
    ['start', '2026-03-01T00:00:00.000Z'],
    ['end', '2026-03-10T00:00:00.000Z'],
    ['tz', 'UTC'],
    ['unit', 'day'],
    ['compare', 'none'],
    ['view', 'bar'],
    ['match', 'all'],
    ['fs', JSON.stringify(['event', 'signup', []])],
    ['fs', JSON.stringify(['event', 'onboarding_completed', []])],
    ['fw', '1440'],
  ]);
  return `/studio/${projectId}/explore?${params}`;
}

async function seriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.filter(violation =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
}

test.beforeEach(async ({ page, request }) => {
  await loginPage(page, request);
});

test('account to user to session evidence preserves context and remains accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/${projectId}/audiences?q=Acme&sort=lastSeenAt&direction=desc`);
  await expect(page.getByRole('table', { name: 'Project accounts' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Acme Cloud' })).toBeVisible();
  await page
    .getByRole('row', { name: /Acme Cloud/ })
    .getByRole('button', { name: /Open profile/ })
    .click();
  const account = page.getByRole('dialog', { name: 'Acme Cloud' });
  await expect(account.getByText(/\d+ sessions · \d+ events/, { exact: true })).toBeVisible();
  await account.getByRole('button', { name: 'Alice Morgan' }).click();
  const user = page.getByRole('dialog', { name: 'Alice Morgan' });
  await expect(user.getByRole('heading', { name: 'Session evidence' })).toBeVisible();
  await user.getByRole('link', { name: 'Open evidence' }).first().click();

  await expect(page).toHaveURL(/\/experience\?sessionId=/);
  await expect(page.getByRole('heading', { name: 'Session evidence', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Observed events' })).toBeVisible();
  await expect(page.getByText('Replay is available with strict masking.')).toBeVisible();
  expect(await seriousAxeViolations(page)).toEqual([]);
  const playerStartedAt = Date.now();
  await page.getByRole('button', { name: 'Load replay' }).click();
  await expect(page.locator('.rr-player')).toBeVisible();
  const playerReadyMs = Date.now() - playerStartedAt;
  console.info(`M12_PLAYER_READY ${playerReadyMs}ms`);
  expect(playerReadyMs).toBeLessThan(3000);
  const replayControl = page.locator('.rr-controller button').first();
  await replayControl.focus();
  await expect(replayControl).toBeFocused();
  await page.getByRole('link', { name: 'Back to analysis' }).click();
  await expect(page).toHaveURL(/\/audiences\?q=Acme&sort=lastSeenAt&direction=desc/);
  await expect(page.getByRole('table', { name: 'Project accounts' })).toBeVisible();
});

test('operational Segment previews exact size, persists, exposes dependencies and deletes cleanly', async ({
  page,
}) => {
  await page.goto(`/studio/${projectId}/audiences?view=segments`);
  const name = `Operational segment ${Date.now()}`;
  await page.getByLabel('Segment name').fill(name);
  await page.getByRole('button', { name: 'Preview size' }).click();
  await expect(page.getByText(/exact users/)).toBeVisible();
  await expect(page.getByText(/^Evaluated /)).toBeVisible();
  await page.getByRole('button', { name: 'Save Segment' }).click();
  const item = page.getByRole('listitem').filter({ hasText: name });
  await expect(item.getByText('No saved dependencies')).toBeVisible();
  await item.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
});

test('funnel member opens matching evidence and Back restores the complete aggregate URL', async ({
  page,
}) => {
  await page.goto(funnelUrl());
  await page.getByRole('button', { name: 'Dropped actors' }).last().click();
  const members = page.getByRole('dialog', { name: 'Exact members' });
  await members
    .getByRole('link', { name: /Open session/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Session evidence', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to analysis' }).click();
  await expect(page).toHaveURL(/mode=funnel/);
  await expect(page.getByRole('heading', { name: 'Ordered funnel' })).toBeVisible();
});
