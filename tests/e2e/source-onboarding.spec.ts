import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { authHeaders, deleteUser, deleteWebsite, loginViaApi } from './helpers';

test('create project → install tracker → ingest real event → see event in Explore', async ({
  page,
  request,
}) => {
  const admin = await loginViaApi(request);
  const username = `source-${randomUUID().slice(0, 12)}`;
  const password = randomUUID();
  const createdUser = await request.post('/api/users', {
    headers: authHeaders(admin),
    data: { username, password, role: 'user' },
  });
  expect(createdUser.status()).toBe(200);
  const userId = (await createdUser.json()).id;
  const auth = await loginViaApi(request, username, password);
  await page.addInitScript(token => {
    localStorage.setItem('umami.auth', JSON.stringify(token));
    localStorage.setItem('umami.locale', JSON.stringify('en-US'));
  }, auth.token);
  const name = `Source ${randomUUID().slice(0, 8)}`;
  let projectId = '';
  try {
    await page.goto('/studio');
    await page.getByRole('textbox', { name: 'Project name', exact: true }).fill(name);
    await page
      .getByRole('textbox', { name: 'Website address', exact: true })
      .fill('https://product.example.com/path');
    const creation = page.waitForResponse(
      response =>
        response.url().endsWith('/api/websites') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    projectId = (await (await creation).json()).id;
    await expect(page).toHaveURL(/\/studio\/[^/]+\/sources$/);
    await expect(
      page.getByRole('heading', { name: 'Connect your data', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Tracking snippet' })).toHaveValue(
      new RegExp(`data-website-id="${projectId}"`),
    );
    await expect(page.getByText('Waiting for your first event', { exact: true })).toBeVisible();
    const violations = (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''));
    expect(violations).toEqual([]);
    const response = await request.post('/api/send', {
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' },
      data: {
        type: 'event',
        payload: {
          website: projectId,
          hostname: 'product.example.com',
          url: 'https://product.example.com/start',
          name: 'first_action',
          language: 'en-US',
          screen: '1440x900',
        },
      },
    });
    expect(response.status()).toBe(200);
    await page.getByRole('button', { name: 'Check connection' }).click();
    await expect(page.getByText('Your source is receiving events', { exact: true })).toBeVisible();
    const result = await request.post(`/api/projects/${projectId}/analytics/query`, {
      headers: authHeaders(auth),
      data: {
        version: 1,
        projectId,
        mode: 'breakdown',
        range: {
          startAt: new Date(Date.now() - 60_000).toISOString(),
          endAt: new Date(Date.now() + 60_000).toISOString(),
          timezone: 'UTC',
          unit: 'day',
        },
        measure: { source: 'event', key: '*', aggregation: 'count' },
        filters: [],
        match: 'all',
        comparison: 'none',
        breakdown: { field: 'eventName', limit: 10 },
        visualization: 'table',
      },
    });
    expect(result.status()).toBe(200);
    expect((await result.json()).data.rows).toEqual([{ key: 'first_action', value: 1 }]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: 'Explore events', exact: true }).click();
    await expect(page).toHaveURL(/\/explore/);
  } finally {
    if (projectId) await deleteWebsite(request, admin, projectId);
    await deleteUser(request, admin, userId);
  }
});
