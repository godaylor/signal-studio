import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { uuid } from '../../src/lib/crypto';

export type Auth = {
  token: string;
  authorization: string;
};

export const umamiUser = {
  username: process.env.UMAMI_USER ?? 'admin',
  password: process.env.UMAMI_PASSWORD ?? 'umami',
  id: process.env.UMAMI_USER_ID ?? '41e2b680-648e-4b09-bcd7-3e2b10c06264',
};

export const authHeaders = (auth: Auth) => ({
  'Content-Type': 'application/json',
  Authorization: auth.authorization,
});

export async function loginViaApi(
  request: APIRequestContext,
  username = umamiUser.username,
  password = umamiUser.password,
): Promise<Auth> {
  const response = await request.post('/api/auth/login', {
    data: { username, password },
  });

  expect(response.status()).toBe(200);

  const body = await response.json();

  return {
    token: body.token,
    authorization: `bearer ${body.token}`,
  };
}

export async function loginPage(page: Page, request: APIRequestContext): Promise<Auth> {
  const auth = await loginViaApi(request);

  await page.addInitScript(token => {
    window.localStorage.setItem('umami.auth', JSON.stringify(token));
    // Legacy workflow assertions use English; explicit RU test setup/URLs win.
    if (!window.localStorage.getItem('umami.locale')) {
      window.localStorage.setItem('umami.locale', JSON.stringify('en-US'));
    }
  }, auth.token);

  return auth;
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: umamiUser.username }).first().click();
  await page.getByRole('menuitem', { name: /logout/i }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function addWebsite(
  request: APIRequestContext,
  auth: Auth,
  name: string,
  domain: string,
) {
  const response = await request.post('/api/websites', {
    headers: authHeaders(auth),
    data: {
      id: uuid(),
      createdBy: umamiUser.id,
      name,
      domain,
    },
  });

  expect(response.status()).toBe(200);

  return response.json();
}

export async function deleteWebsite(
  request: APIRequestContext,
  auth: Auth,
  websiteId: string,
  allowMissing = false,
) {
  const response = await request.delete(`/api/websites/${websiteId}`, {
    headers: authHeaders(auth),
  });

  expect(allowMissing ? [200, 404] : [200]).toContain(response.status());
}

export async function addUser(
  request: APIRequestContext,
  auth: Auth,
  username: string,
  password: string,
  role: string,
) {
  const response = await request.post('/api/users', {
    headers: authHeaders(auth),
    data: { username, password, role },
  });

  expect(response.status()).toBe(200);

  return response.json();
}

export async function deleteUser(
  request: APIRequestContext,
  auth: Auth,
  userId: string,
  allowMissing = false,
) {
  const response = await request.delete(`/api/users/${userId}`, {
    headers: authHeaders(auth),
  });

  expect(allowMissing ? [200, 404] : [200]).toContain(response.status());
}

export async function addTeam(request: APIRequestContext, auth: Auth, name: string) {
  const response = await request.post('/api/teams', {
    headers: authHeaders(auth),
    data: { name },
  });

  expect(response.status()).toBe(200);

  return response.json();
}

export async function deleteTeam(
  request: APIRequestContext,
  auth: Auth,
  teamId: string,
  allowMissing = false,
) {
  const response = await request.delete(`/api/teams/${teamId}`, {
    headers: authHeaders(auth),
  });

  expect(allowMissing ? [200, 404] : [200]).toContain(response.status());
}
