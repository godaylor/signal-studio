import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginPage } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const snapshot = {
  version: 1,
  snapshotId: 'e2e-snapshot',
  generatedAt: '2026-09-03T12:00:00.000Z',
  freshnessAt: '2026-09-03T11:59:30.000Z',
  range: { start: '2026-09-03T11:30:00.000Z', end: '2026-09-03T12:00:00.000Z', boundary: '[start,end)', timezone: 'UTC', unit: 'minute' },
  transport: { kind: 'polling', recommendedPollMs: 10_000, cacheTtlMs: 8_000 },
  cache: 'hit',
  totals: { views: 12, visitors: 5, events: 3, countries: 2, activeUsers: 4, activeAccounts: 2 },
  series: { views: [{ time: '2026-09-03T11:59:00.000Z', value: 12 }], visitors: [{ time: '2026-09-03T11:59:00.000Z', value: 5 }] },
  activity: [{ id: 'activity-1', type: 'event', sessionId: 'session-a', eventName: 'upgrade_clicked', createdAt: '2026-09-03T11:59:30.000Z', urlPath: '/billing', browser: 'chrome', device: 'desktop', country: 'US' }],
  topBehaviors: [{ key: 'event:upgrade_clicked', label: 'upgrade_clicked', current: 3, previous: 1, changePercent: 200 }],
  warnings: [],
  definitions: { activeUsers: 'Distinct identified tracked users observed in the trailing 30-minute window.', activeAccounts: 'Distinct linked accounts observed in the trailing 30-minute window.', lateArrivals: 'Late-arriving events appear in the next successful snapshot while in range.' },
};

test('Live pauses polling, preserves the last snapshot on failure, reconnects and remains accessible', async ({ page, request }) => {
  await loginPage(page, request);
  let requests = 0;
  let fail = false;
  await page.route(`**/api/projects/${projectId}/live`, async route => {
    requests += 1;
    if (fail) await route.abort('failed');
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) });
  });

  await page.goto(`/studio/${projectId}/live`);
  await expect(page.getByRole('heading', { name: 'Current activity' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('Shared snapshot')).toBeVisible();
  expect(requests).toBe(1);

  await page.getByRole('button', { name: 'Pause live view' }).click();
  await expect(page.getByText('Paused')).toBeVisible();
  await page.waitForTimeout(10_500);
  expect(requests).toBe(1);

  fail = true;
  await page.getByRole('button', { name: 'Resume live view' }).click();
  await page.getByRole('button', { name: 'Refresh now' }).click();
  const connectionAlert = page.getByRole('alert').filter({ hasText: 'Showing the last valid snapshot' });
  await expect(connectionAlert).toContainText('Showing the last valid snapshot');
  await expect(page.getByText('upgrade_clicked').first()).toBeVisible();

  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(connectionAlert).toHaveCount(0);
  await expect(page.getByText('Connected · adaptive polling')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Pause live view' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});
