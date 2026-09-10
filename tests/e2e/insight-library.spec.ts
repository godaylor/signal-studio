import { expect, test } from '@playwright/test';
import { authHeaders, loginPage, loginViaApi } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const endpoint = `/api/projects/${projectId}/insights`;
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

function exploreUrl() {
  const params = new URLSearchParams([
    ['aqv', '1'],
    ['project', projectId],
    ['mode', 'trend'],
    ['event', 'signup'],
    ['aggregation', 'count'],
    ['start', query.range.startAt],
    ['end', query.range.endAt],
    ['tz', 'UTC'],
    ['unit', 'day'],
    ['compare', 'none'],
    ['view', 'line'],
    ['match', 'all'],
  ]);
  return `/studio/${projectId}/explore?${params}`;
}

test('Insight API persists normalized query, searches, duplicates independently and archives', async ({
  request,
}) => {
  const unauthenticated = await request.post(endpoint, { data: { title: 'Denied', query } });
  expect(unauthenticated.status()).toBe(401);

  const auth = await loginViaApi(request);
  const headers = authHeaders(auth);
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const title = `Lifecycle ${suffix}`;
  const createdResponse = await request.post(endpoint, {
    headers,
    data: { title, description: 'M7 lifecycle', query, visualization: { type: 'line' } },
  });
  expect(createdResponse.status()).toBe(200);
  const created = await createdResponse.json();
  expect(created).toMatchObject({
    title,
    queryVersion: 1,
    query,
    compatibility: { state: 'ready' },
    dependencies: { dashboards: 0 },
  });

  const listedResponse = await request.get(
    `${endpoint}?search=${encodeURIComponent(suffix)}&owner=mine&limit=1`,
    { headers },
  );
  expect(listedResponse.status()).toBe(200);
  const listed = await listedResponse.json();
  expect(listed.data).toHaveLength(1);
  expect(listed.data[0].id).toBe(created.id);

  const duplicateResponse = await request.post(`${endpoint}/${created.id}/duplicate`, { headers });
  expect(duplicateResponse.status()).toBe(200);
  const duplicate = await duplicateResponse.json();
  expect(duplicate).toMatchObject({ title: `Copy of ${title}`, favorite: false, query });
  expect(duplicate.id).not.toBe(created.id);

  const changedQuery = { ...query, measure: { ...query.measure, key: 'purchase' } };
  const updateCopy = await request.patch(`${endpoint}/${duplicate.id}`, {
    headers,
    data: { title: `Edited ${suffix}`, favorite: true, query: changedQuery },
  });
  expect(updateCopy.status()).toBe(200);
  await expect(updateCopy.json()).resolves.toMatchObject({ favorite: true, query: changedQuery });

  const originalResponse = await request.get(`${endpoint}/${created.id}`, { headers });
  await expect(originalResponse.json()).resolves.toMatchObject({ query });

  for (const id of [created.id, duplicate.id]) {
    const archive = await request.patch(`${endpoint}/${id}`, {
      headers,
      data: { status: 'archived' },
    });
    expect(archive.status()).toBe(200);
    await expect(archive.json()).resolves.toMatchObject({ status: 'archived' });
  }
  const archived = await request.get(
    `${endpoint}?status=archived&search=${encodeURIComponent(suffix)}`,
    { headers },
  );
  expect((await archived.json()).data).toHaveLength(2);
});

test('analyst saves Explore as an Insight, reopens the exact query and copies its URL', async ({
  page,
  request,
  context,
}) => {
  await loginPage(page, request);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const title = `Saved activation ${Date.now()}`;
  await page.goto(exploreUrl());
  await expect(page.getByRole('heading', { name: 'signup' })).toBeVisible();

  await page.getByRole('button', { name: 'Save insight' }).click();
  const save = page.getByRole('dialog', { name: 'Save insight' });
  await save.getByLabel('Insight title').fill(title);
  await save.getByLabel('Description').fill('Reproducible activation evidence');
  await save.getByRole('button', { name: 'Save insight' }).click();

  const library = page.getByRole('dialog', { name: 'Insight library' });
  await expect(library.getByRole('heading', { name: title })).toBeVisible();
  const item = library.getByRole('listitem').filter({ hasText: title });
  await item.getByRole('button', { name: 'Reopen' }).click();
  await expect(page).toHaveURL(/event=signup/);
  await expect(page.getByRole('heading', { name: 'signup' })).toBeVisible();

  await page.getByRole('button', { name: 'Copy URL' }).click();
  await expect(page.getByRole('button', { name: 'URL copied' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});
