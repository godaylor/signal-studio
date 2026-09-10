import { expect, test } from '@playwright/test';
import { authHeaders, loginViaApi } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';

test('Project facade and tracked identity APIs cross auth, permission and service boundaries', async ({
  request,
}) => {
  const auth = await loginViaApi(request);
  const projectsResponse = await request.get('/api/projects', { headers: authHeaders(auth) });

  expect(projectsResponse.status()).toBe(200);
  const projects = (await projectsResponse.json()).data as Array<Record<string, unknown>>;
  expect(projects).toContainEqual(
    expect.objectContaining({
      id: projectId,
      name: 'Signal Studio Demo Project',
      permissionScope: 'identity-sensitive',
      source: expect.objectContaining({ type: 'website', domain: 'demo.signal-studio.local' }),
    }),
  );

  const usersResponse = await request.get(`/api/projects/${projectId}/tracked-users?limit=50`, {
    headers: authHeaders(auth),
  });
  expect(usersResponse.status()).toBe(200);
  const users = await usersResponse.json();
  expect(users.permissionScope).toBe('identity-sensitive');
  expect(users.data).toHaveLength(3);
  expect(users.data).toContainEqual(
    expect.objectContaining({
      externalId: 'user-alice',
      lifecycleStage: 'retained',
      sensitiveTraits: { email: 'alice@acme.demo' },
    }),
  );

  const accountsResponse = await request.get(`/api/projects/${projectId}/accounts?limit=50`, {
    headers: authHeaders(auth),
  });
  expect(accountsResponse.status()).toBe(200);
  const accounts = await accountsResponse.json();
  expect(accounts.permissionScope).toBe('identity-sensitive');
  expect(accounts.data).toHaveLength(2);
  expect(accounts.data).toContainEqual(
    expect.objectContaining({ externalId: 'acme-enterprise', lifecycleStage: 'retained' }),
  );
});

test('tracked identity API denies unauthenticated access and rejects malformed cursors', async ({
  request,
}) => {
  const unauthenticated = await request.get(`/api/projects/${projectId}/tracked-users`);
  expect(unauthenticated.status()).toBe(401);

  const auth = await loginViaApi(request);
  const malformed = await request.get(
    `/api/projects/${projectId}/tracked-users?cursor=not-a-cursor`,
    { headers: authHeaders(auth) },
  );
  expect(malformed.status()).toBe(400);
  await expect(malformed.json()).resolves.toMatchObject({
    error: { code: 'invalid-identity-cursor', status: 400 },
  });
});
