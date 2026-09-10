import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginPage } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';

function exploreUrl() {
  const params = new URLSearchParams([
    ['aqv', '1'],
    ['project', projectId],
    ['mode', 'trend'],
    ['event', 'signup'],
    ['aggregation', 'count'],
    ['start', '2026-03-01T00:00:00.000Z'],
    ['end', '2026-03-10T00:00:00.000Z'],
    ['tz', 'UTC'],
    ['unit', 'day'],
    ['compare', 'none'],
    ['view', 'line'],
    ['match', 'all'],
  ]);

  return `/studio/${projectId}/explore?${params}`;
}

function advancedUrl(mode: 'funnel' | 'retention') {
  const params = new URLSearchParams([
    ['aqv', '1'],
    ['project', projectId],
    ['mode', mode],
    ['event', 'signup'],
    ['aggregation', 'count'],
    ['start', '2026-03-01T00:00:00.000Z'],
    ['end', '2026-03-10T00:00:00.000Z'],
    ['tz', 'UTC'],
    ['unit', mode === 'retention' ? 'day' : 'day'],
    ['compare', 'none'],
    ['view', mode === 'retention' ? 'matrix' : 'bar'],
    ['match', 'all'],
  ]);
  if (mode === 'funnel') {
    params.append('fs', JSON.stringify(['event', 'signup', []]));
    params.append('fs', JSON.stringify(['event', 'onboarding_completed', []]));
    params.append('fw', '1440');
  } else {
    params.append('entry', JSON.stringify(['event', 'signup', []]));
    params.append('return', JSON.stringify(['event', 'core_feature_used', []]));
    params.append('periods', '3');
  }
  return `/studio/${projectId}/explore?${params}`;
}

test.beforeEach(async ({ page, request }) => {
  await loginPage(page, request);
});

test('Explore renders one accessible chart/table result and opens bounded drill-down evidence', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(exploreUrl());

  await expect(page.getByRole('heading', { name: 'signup' })).toBeVisible();
  await expect(page.getByRole('img', { name: /signup returned 3 exact events/ })).toBeVisible();
  const table = page.getByRole('table', { name: /Equivalent data table/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole('cell', { name: '1', exact: true })).toHaveCount(3);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blockingViolations = results.violations.filter(violation =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
  expect(blockingViolations).toEqual([]);

  await page.getByRole('button', { name: 'Drill down' }).first().click();
  await expect(page.getByRole('dialog', { name: /Affected sessions/ })).toBeVisible();
  await expect(page.getByText(/Session evidence is capped at 8 rows/)).toBeVisible();
});

test('funnel analysis survives URL and Insight round-trip with exact drill-down', async ({
  page,
}) => {
  await page.goto(advancedUrl('funnel'));
  await expect(page.getByRole('heading', { name: 'Ordered funnel' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Equivalent funnel data table' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Conversion trend' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Time-to-convert distribution' })).toBeVisible();
  await page.getByRole('button', { name: 'Dropped actors' }).last().click();
  await expect(page.getByRole('dialog', { name: 'Exact members' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const title = `Funnel insight ${Date.now()}`;
  await page.getByRole('button', { name: 'Save insight' }).click();
  const save = page.getByRole('dialog', { name: 'Save insight' });
  await save.getByLabel('Insight title').fill(title);
  await save.getByRole('button', { name: 'Save insight' }).click();
  const library = page.getByRole('dialog', { name: 'Insight library' });
  const item = library.getByRole('listitem').filter({ hasText: title });
  await item.getByRole('button', { name: 'Reopen' }).click();
  await expect(page).toHaveURL(/mode=funnel/);
  await expect(page.getByRole('heading', { name: 'Ordered funnel' })).toBeVisible();
});

test('retention matrix saves and reuses a behavioral Cohort accessibly', async ({ page }) => {
  await page.goto(advancedUrl('retention'));
  await expect(page.getByRole('heading', { name: 'Behavioral retention' })).toBeVisible();
  await expect(page.getByRole('table', { name: /Retention matrix/ })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Weighted retention curve' })).toBeVisible();
  await page.getByRole('button', { name: /Measure/ }).click();
  const cohortName = `Activation cohort ${Date.now()}`;
  await page.getByLabel('Cohort name').fill(cohortName);
  await page.getByRole('button', { name: 'Save Cohort' }).click();
  await expect(page.getByText('Cohort saved and ready to reuse.')).toBeVisible();
  await expect(
    page.getByLabel('Reuse saved Cohort').getByRole('option', { name: cohortName }),
  ).toHaveCount(1);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.filter(violation =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
});
