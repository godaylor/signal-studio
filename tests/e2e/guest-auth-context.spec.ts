import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { hashPassword } from '../../src/lib/password';
import prisma from '../../src/lib/prisma';
import { issueAuthToken } from '../../src/server/auth/tokens';

const browserLabel = process.platform === 'win32' ? 'installed Chrome' : 'Chromium';
test.use({
  ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
  actionTimeout: 30_000,
});

const ids = { user: randomUUID(), project: randomUUID() };
const username = `m20-auth-${ids.user}`;
const password = randomBytes(24).toString('base64url');
let accountToken: string;
let expiredToken: string;

test.beforeAll(async () => {
  const database = new URL(process.env.DATABASE_URL || 'https://missing.invalid');
  if (!['127.0.0.1', 'localhost'].includes(database.hostname))
    throw new Error('Mixed-auth browser fixtures require an isolated local database.');
  const user = await prisma.client.user.create({
    data: { id: ids.user, username, password: hashPassword(password), role: 'user' },
  });
  await prisma.client.website.create({
    data: { id: ids.project, userId: ids.user, name: 'M20 preserved account project' },
  });
  accountToken = issueAuthToken(user, 1);
  expiredToken = issueAuthToken(user, 1, { expiresIn: -1 });
});

test.afterAll(async () => {
  await prisma.client.securityAuditEvent.deleteMany({ where: { actorUserId: ids.user } });
  await prisma.client.website.deleteMany({ where: { id: ids.project } });
  await prisma.client.user.deleteMany({ where: { id: ids.user } });
  await prisma.client.$disconnect();
});

test.afterEach(async ({ context }) => {
  await context.request.delete('/api/guest');
});

async function putAccountInBrowser(page: Page, token: string) {
  await page.goto('/login?locale=en-US');
  await page.evaluate(value => {
    localStorage.setItem('umami.auth', JSON.stringify(value));
    sessionStorage.removeItem('umami.auth.mode');
  }, token);
}

async function startGuest(context: BrowserContext) {
  const deadline = Date.now() + 65_000;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await context.request.post('/api/guest');
    if (response.status() !== 429 || attempt === 2) return response;
    const seconds = Number(response.headers()['retry-after']);
    const delay = seconds * 1000 + 100;
    // Respect the real server budget. Longer per-client/capacity limits fail
    // normally; this bounded retry only accommodates the shared minute window.
    if (!Number.isFinite(seconds) || seconds < 0 || Date.now() + delay > deadline) return response;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('Guest creation retries exhausted.');
}

async function enterGuest(page: Page, context: BrowserContext, token: string, kind: string) {
  const started = await startGuest(context);
  expect(started.status(), await started.text()).toBe(200);
  const { guest } = await started.json();
  await putAccountInBrowser(page, token);

  // This reproduces the old failure: a normal bearer wins over the guest cookie;
  // an invalid bearer is denied, rather than silently falling back to that cookie.
  const legacyVerify = await context.request.post('/api/auth/verify', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(legacyVerify.status()).toBe(kind === 'valid' ? 200 : 401);
  if (kind === 'valid') {
    expect((await legacyVerify.json()).id).toBe(ids.user);
    expect(
      (
        await context.request.get(`/api/projects/${guest.projectId}/access`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status(),
    ).toBe(403);
  }

  const verified = page.waitForResponse(
    response =>
      response.url().endsWith('/api/auth/verify') && response.request().method() === 'POST',
  );
  const calculated = page.waitForResponse(
    response =>
      response.url().endsWith(`/api/projects/${guest.projectId}/analytics/query`) &&
      response.request().method() === 'POST',
  );
  const entered = page.waitForResponse(
    response => response.url().endsWith('/api/guest') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Try without|Попробовать без регистрации/ }).click();
  expect((await entered).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/studio/${guest.projectId}/explore\\?`), {
    timeout: 30_000,
  });
  const response = await verified;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ isGuest: true });
  expect('authorization' in response.request().headers()).toBe(false);
  const calculation = await calculated;
  expect(calculation.status()).toBe(200);
  expect('authorization' in calculation.request().headers()).toBe(false);
  expect(
    (await calculation.json()).data.rows
      .filter((row: { kind?: string }) => row.kind === 'funnel-step')
      .map((row: { converted: number }) => row.converted),
  ).toEqual([336, 252, 168]);
  await expect(page.getByRole('table', { name: 'Equivalent funnel data table' })).toContainText(
    '336',
  );
  expect(
    await page.evaluate(
      value => JSON.parse(localStorage.getItem('umami.auth') ?? 'null') === value,
      token,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('umami.auth.mode') ?? 'null')),
  ).toBe('guest');

  const reloadVerify = page.waitForResponse(
    item => item.url().endsWith('/api/auth/verify') && item.request().method() === 'POST',
  );
  await page.reload();
  expect((await reloadVerify).status()).toBe(200);
  await expect(page.getByRole('table', { name: 'Equivalent funnel data table' })).toContainText(
    '168',
  );
  return guest;
}

for (const kind of ['valid', 'invalid', 'expired'] as const) {
  test(`${browserLabel} enters and reloads a guest workspace with a ${kind} persisted account bearer`, async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    const token =
      kind === 'valid'
        ? accountToken
        : kind === 'expired'
          ? expiredToken
          : 'stale-invalid-browser-token';
    const guest = await enterGuest(page, context, token, kind);

    if (kind === 'valid') {
      // A separate tab still uses the original account session, while this tab is a guest.
      const accountTab = await context.newPage();
      const normalVerified = accountTab.waitForResponse(
        response =>
          response.url().endsWith('/api/auth/verify') && response.request().method() === 'POST',
      );
      await accountTab.goto(`/studio/${ids.project}/home?locale=en-US`);
      const normalResponse = await normalVerified;
      expect(normalResponse.status()).toBe(200);
      expect((await normalResponse.json()).id).toBe(ids.user);
      expect(normalResponse.request().headers().authorization === `Bearer ${accountToken}`).toBe(
        true,
      );
      expect(await accountTab.evaluate(() => sessionStorage.getItem('umami.auth.mode'))).toBeNull();

      await page.goto(`/studio/${randomUUID()}/dashboards?dashboard=old-guest&locale=en-US`);
      await expect(page).toHaveURL(new RegExp(`/studio/${guest.projectId}/explore\\?`));
      await expect(page.getByRole('table', { name: 'Equivalent funnel data table' })).toContainText(
        '336',
      );

      await page.goto('/logout');
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      expect(
        await page.evaluate(
          value => JSON.parse(localStorage.getItem('umami.auth') ?? 'null') === value,
          accountToken,
        ),
      ).toBe(true);
      expect(await page.evaluate(() => sessionStorage.getItem('umami.auth.mode'))).toBeNull();
      const preserved = await context.request.post('/api/auth/verify', {
        headers: { authorization: `Bearer ${accountToken}` },
      });
      expect(preserved.status()).toBe(200);
      expect((await preserved.json()).id).toBe(ids.user);
      expect((await context.request.post('/api/auth/verify')).status()).toBe(401);
      await accountTab.close();
    } else if (kind === 'invalid') {
      // Explicit account login leaves guest mode even though its HttpOnly cookie still exists.
      await page.goto('/login?locale=en-US');
      await page.getByTestId('input-username').locator('input').fill(username);
      await page.getByTestId('input-password').locator('input').fill(password);
      await page.getByTestId('button-submit').click();
      await expect(page).toHaveURL(new RegExp(`/studio/${ids.project}/home`));
      expect(await page.evaluate(() => sessionStorage.getItem('umami.auth.mode'))).toBeNull();
      const verified = page.waitForResponse(
        response =>
          response.url().endsWith('/api/auth/verify') && response.request().method() === 'POST',
      );
      await page.reload();
      const normalResponse = await verified;
      expect((await normalResponse.json()).id).toBe(ids.user);
      expect(normalResponse.request().headers().authorization).toMatch(/^Bearer /);
      const guestStillExists = await context.request.get('/api/guest');
      expect((await guestStillExists.json()).guest.id).toBe(guest.id);
    }
  });
}
