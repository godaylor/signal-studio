import { expect, test } from '@playwright/test';
import { authHeaders, loginViaApi } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const endpoint = `/api/projects/${projectId}/analytics/query`;
const query = {
  version: 1,
  projectId,
  mode: 'trend',
  range: {
    startAt: '2026-03-01T00:00:00.000Z',
    endAt: '2026-03-10T00:00:00.000Z',
    timezone: 'UTC',
    unit: 'day',
  },
  measure: { source: 'event', key: 'signup', aggregation: 'count' },
  filters: [],
  match: 'all',
  comparison: 'none',
  visualization: 'line',
};

test('AnalysisQuery API crosses auth, permission and PostgreSQL service boundaries', async ({
  request,
}) => {
  const unauthenticated = await request.post(endpoint, { data: query });
  expect(unauthenticated.status()).toBe(401);

  const auth = await loginViaApi(request);
  const response = await request.post(endpoint, { headers: authHeaders(auth), data: query });

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    queryVersion: 1,
    exactness: 'exact',
    cache: 'miss',
    data: {
      mode: 'trend',
      rows: [
        { bucket: '2026-03-01T00:00:00Z', value: 1 },
        { bucket: '2026-03-02T00:00:00Z', value: 1 },
        { bucket: '2026-03-03T00:00:00Z', value: 1 },
      ],
    },
  });
});

test('AnalysisQuery API returns an actionable query budget response', async ({ request }) => {
  const auth = await loginViaApi(request);
  const response = await request.post(endpoint, {
    headers: authHeaders(auth),
    data: {
      ...query,
      range: {
        ...query.range,
        startAt: '2024-01-01T00:00:00.000Z',
        endAt: '2026-01-02T00:00:00.000Z',
      },
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'analysis-range-too-large',
      details: { path: ['range'], hint: 'Shorten the date range and retry.' },
    },
  });
});
