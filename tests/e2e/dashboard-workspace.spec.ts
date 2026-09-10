import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { authHeaders, loginPage, loginViaApi } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const dashboardsEndpoint = `/api/projects/${projectId}/dashboards`;
function analysisQuery(event = 'signup') {
  return {
    version: 1,
    projectId,
    mode: 'trend',
    range: {
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-10T00:00:00.000Z',
      timezone: 'UTC',
      unit: 'day',
    },
    measure: { source: 'event', key: event, aggregation: 'count' },
    filters: [],
    match: 'all',
    comparison: 'none',
    visualization: 'line',
  };
}
async function createInsight(request: any, headers: Record<string, string>, title: string) {
  const response = await request.post(`/api/projects/${projectId}/insights`, {
    headers,
    data: { title, query: analysisQuery(), visualization: { type: 'line' } },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

test('Dashboard API references Insights and supports add/remove/reorder/resize/global context', async ({
  request,
}) => {
  const denied = await request.post(dashboardsEndpoint, { data: { title: 'Denied' } });
  expect(denied.status()).toBe(401);
  const auth = await loginViaApi(request);
  const headers = authHeaders(auth);
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const insight = await createInsight(request, headers, `Dashboard source ${suffix}`);
  const createdResponse = await request.post(dashboardsEndpoint, {
    headers,
    data: { title: `API dashboard ${suffix}` },
  });
  expect(createdResponse.status()).toBe(200);
  const dashboard = await createdResponse.json();

  const insightWidgetResponse = await request.post(
    `${dashboardsEndpoint}/${dashboard.id}/widgets`,
    {
      headers,
      data: { kind: 'insight', insightId: insight.id },
    },
  );
  const withInsight = await insightWidgetResponse.json();
  expect(withInsight.widgets[0]).toMatchObject({ kind: 'insight', insightId: insight.id });
  expect(withInsight.widgets[0]).not.toHaveProperty('query');

  const noteResponse = await request.post(`${dashboardsEndpoint}/${dashboard.id}/widgets`, {
    headers,
    data: { kind: 'note', title: 'Decision', body: 'Review weekly.' },
  });
  const withNote = await noteResponse.json();
  const insightWidget = withNote.widgets.find((item: any) => item.kind === 'insight');
  const noteWidget = withNote.widgets.find((item: any) => item.kind === 'note');

  const reorderedResponse = await request.patch(
    `${dashboardsEndpoint}/${dashboard.id}/widgets/${insightWidget.id}`,
    {
      headers,
      data: { position: 1, width: 2 },
    },
  );
  const reordered = await reorderedResponse.json();
  expect(reordered.widgets.map((item: any) => item.kind)).toEqual(['note', 'insight']);
  expect(reordered.widgets[1].width).toBe(2);

  const resizedResponse = await request.patch(
    `${dashboardsEndpoint}/${dashboard.id}/widgets/${insightWidget.id}`,
    {
      headers,
      data: { width: 3 },
    },
  );
  const resized = await resizedResponse.json();
  expect(resized.widgets.map((item: any) => item.kind)).toEqual(['note', 'insight']);
  expect(resized.widgets[1].width).toBe(3);

  const removedResponse = await request.delete(
    `${dashboardsEndpoint}/${dashboard.id}/widgets/${noteWidget.id}`,
    { headers },
  );
  await expect(removedResponse.json()).resolves.toMatchObject({
    widgets: [{ kind: 'insight', position: 0 }],
  });

  const globalContext = {
    range: {
      startAt: '2026-03-02T00:00:00.000Z',
      endAt: '2026-03-05T00:00:00.000Z',
      timezone: 'UTC',
    },
    segment: { field: 'country', operator: 'equals', value: 'US' },
  };
  const contextResponse = await request.patch(`${dashboardsEndpoint}/${dashboard.id}`, {
    headers,
    data: { globalContext },
  });
  await expect(contextResponse.json()).resolves.toMatchObject({ globalContext });

  const dependencyResponse = await request.get(
    `/api/projects/${projectId}/insights?search=${encodeURIComponent(suffix)}`,
    { headers },
  );
  expect((await dependencyResponse.json()).data[0].dependencies.dashboards).toBe(1);

  const invalidInsight = await request.post(`${dashboardsEndpoint}/${dashboard.id}/widgets`, {
    headers,
    data: { kind: 'insight', insightId: '40000000-0000-4000-8000-000000000099' },
  });
  expect(invalidInsight.status()).toBe(400);
});

test('Insight is assembled into a responsive accessible Dashboard with deduplicated queries', async ({
  page,
  request,
}) => {
  const auth = await loginViaApi(request);
  const headers = authHeaders(auth);
  const insight = await createInsight(request, headers, 'UI source visual');
  await loginPage(page, request);
  let analysisRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/analytics/query') && request.method() === 'POST')
      analysisRequests += 1;
  });

  await page.goto(`/studio/${projectId}/dashboards`);
  await page.getByLabel('New dashboard title').fill('UI dashboard visual');
  await page.getByRole('button', { name: 'Create dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'UI dashboard visual' })).toBeVisible();
  await expect(page.getByLabel('Dashboard editor')).toBeVisible();
  analysisRequests = 0;

  await page.getByLabel('Insight to add').selectOption(insight.id);
  await page.getByRole('button', { name: 'Add Insight' }).click();
  await expect(page.getByRole('heading', { name: insight.title })).toBeVisible();
  await page.getByRole('button', { name: 'Add Insight' }).click();
  await expect(page.getByRole('heading', { name: insight.title })).toHaveCount(2);
  await expect.poll(() => analysisRequests).toBe(1);

  await page.getByRole('button', { name: 'Widen widget' }).first().click();
  await expect(page.getByRole('button', { name: 'Narrow widget' }).first()).toBeEnabled();
  await page.getByLabel('Start date').fill('2026-03-03');
  await page.getByLabel('End date').fill('2026-03-06');
  await page.getByLabel('Segment field').selectOption('country');
  await page.getByLabel('Segment value').fill('US');
  await page.getByRole('button', { name: 'Apply shared context' }).click();
  await expect(page.getByText('Context applied')).toHaveCount(2);
  // A fresh query may be served from the shared client cache. The contract is
  // at most one request per definition, not mandatory duplicate network work.

  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByLabel(/Layout controls/)).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'UI dashboard visual' })).toBeVisible();
  await expect(
    page.getByRole('table', { name: new RegExp(`Data for ${insight.title}`) }).first(),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);
  expect(analysisRequests).toBeLessThanOrEqual(2);
  if (process.platform !== 'win32') return; // Pixel baseline is Windows-specific; axe/flows run on CI too.
  await expect(page.locator('main').last()).toHaveScreenshot('dashboard-mobile.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
    mask: [page.getByText(/updated /), page.getByText(/exact ·/)],
  });
});
