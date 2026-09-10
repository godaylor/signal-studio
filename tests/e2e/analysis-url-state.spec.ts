import { expect, test } from '@playwright/test';
import { loginPage } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const explorePath = `/studio/${projectId}/explore`;

function queryUrl({
  mode,
  event,
  breakdown,
  comparison,
}: {
  mode: 'trend' | 'breakdown';
  event: string;
  breakdown?: string;
  comparison: 'none' | 'previousPeriod';
}) {
  const params = new URLSearchParams([
    ['aqv', '1'],
    ['project', projectId],
    ['mode', mode],
    ['event', event],
    ['aggregation', 'count'],
    ['start', '2026-03-01T00:00:00.000Z'],
    ['end', '2026-03-10T00:00:00.000Z'],
    ['tz', 'UTC'],
    ['unit', 'day'],
    ...(breakdown
      ? ([
          ['breakdown', breakdown],
          ['limit', '10'],
        ] as Array<[string, string]>)
      : []),
    ['compare', comparison],
    ['view', mode === 'trend' ? 'line' : 'table'],
    ['match', 'all'],
    ['f', JSON.stringify(['urlPath', 'contains', '/app'])],
  ]);

  return `${explorePath}?${params}`;
}

test.beforeEach(async ({ page, request }) => {
  await loginPage(page, request);
});

test('copied URL restores exact Explore state through browser back and forward', async ({
  page,
}) => {
  const trend = queryUrl({ mode: 'trend', event: 'signup', comparison: 'previousPeriod' });
  const breakdown = queryUrl({
    mode: 'breakdown',
    event: 'purchase',
    breakdown: 'urlPath',
    comparison: 'none',
  });

  await page.goto(trend);
  await expect(page.getByLabel('Event or metric')).toHaveValue('signup');
  await page.getByRole('button', { name: /Context/ }).click();
  await expect(page.getByLabel('Timezone')).toHaveValue('UTC');
  await expect(page.getByLabel('Comparison')).toHaveValue('previousPeriod');
  await page.getByRole('button', { name: /Filters/ }).click();
  await expect(page.getByLabel('Filter 1 field')).toHaveValue('urlPath');
  await expect(page.getByLabel('Filter 1 value')).toHaveValue('/app');

  await page.goto(breakdown);
  await expect(page.getByLabel('Event or metric')).toHaveValue('purchase');
  await page.getByRole('button', { name: /Breakdown/ }).click();
  await expect(page.getByLabel('Analysis mode')).toHaveValue('breakdown');
  await expect(page.getByLabel('Breakdown dimension')).toHaveValue('urlPath');

  await page.goBack();
  await expect(page.getByLabel('Event or metric')).toHaveValue('signup');
  await page.getByRole('button', { name: /Context/ }).click();
  await expect(page.getByLabel('Comparison')).toHaveValue('previousPeriod');

  await page.goForward();
  await expect(page.getByLabel('Event or metric')).toHaveValue('purchase');
  await page.getByRole('button', { name: /Context/ }).click();
  await expect(page.getByLabel('Result view')).toHaveValue('table');
});

test('unknown URL versions fail safely without hiding the editable Query Spine', async ({
  page,
}) => {
  await page.goto(`${explorePath}?aqv=99`);

  await expect(page.getByRole('heading', { name: 'Question not restored' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Question definition' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeVisible();
});
