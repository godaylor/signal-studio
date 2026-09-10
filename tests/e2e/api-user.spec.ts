import { expect, test } from '@playwright/test';
import { createE2eFixtures } from './fixtures';
import { authHeaders, deleteUser, loginViaApi } from './helpers';

test('user API CRUD is secure, isolated and retry-safe', async ({ request }, testInfo) => {
  const auth = await loginViaApi(request);
  const fixture = createE2eFixtures(testInfo, 'api-user');
  let userId = '';

  try {
    const createResponse = await request.post('/api/users', {
      headers: authHeaders(auth),
      data: fixture.user.create,
    });
    const created = await createResponse.json();
    userId = created.id;

    expect(createResponse.status()).toBe(200);
    expect(created).toMatchObject({ username: fixture.user.create.username, role: 'user' });
    expect(created).not.toHaveProperty('password');

    const listResponse = await request.get('/api/admin/users', { headers: authHeaders(auth) });
    const listed = await listResponse.json();
    const listUser = listed.data.find(item => item.id === userId);

    expect(listResponse.status()).toBe(200);
    expect(listUser).toMatchObject({ id: userId, username: fixture.user.create.username });
    expect(listUser).not.toHaveProperty('password');

    const updateResponse = await request.post(`/api/users/${userId}`, {
      headers: authHeaders(auth),
      data: fixture.user.update,
    });
    expect(updateResponse.status()).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({ id: userId, role: 'view-only' });

    for (const resource of ['', '/websites', '/teams']) {
      const response = await request.get(`/api/users/${userId}${resource}`, {
        headers: authHeaders(auth),
      });
      expect(response.status()).toBe(200);
    }

    await deleteUser(request, auth, userId);
    userId = '';
  } finally {
    if (userId) await deleteUser(request, auth, userId, true);
  }
});
