import { expect, test } from '@playwright/test';
import { createE2eFixtures } from './fixtures';
import { authHeaders, deleteTeam, deleteUser, loginViaApi, umamiUser } from './helpers';

test('team API CRUD owns and cleans unique retry-safe state', async ({ request }, testInfo) => {
  const auth = await loginViaApi(request);
  const fixture = createE2eFixtures(testInfo, 'api-team');
  let teamId = '';
  let userId = '';

  try {
    const userResponse = await request.post('/api/users', {
      headers: authHeaders(auth),
      data: fixture.user.create,
    });
    expect(userResponse.status()).toBe(200);
    userId = (await userResponse.json()).id;

    const createResponse = await request.post('/api/teams', {
      headers: authHeaders(auth),
      data: fixture.team.create,
    });
    const created = await createResponse.json();
    expect(createResponse.status()).toBe(200);
    teamId = created[0].id;
    expect(created[0]).toMatchObject({ name: fixture.team.create.name });
    expect(created[1]).toMatchObject({ role: 'team-owner' });

    const getResponse = await request.get(`/api/teams/${teamId}`, {
      headers: authHeaders(auth),
    });
    expect(getResponse.status()).toBe(200);

    const updateResponse = await request.post(`/api/teams/${teamId}`, {
      headers: authHeaders(auth),
      data: fixture.team.update,
    });
    await expect(updateResponse.json()).resolves.toMatchObject({
      id: teamId,
      name: fixture.team.update.name,
    });

    for (const resource of ['users', 'websites']) {
      const response = await request.get(`/api/teams/${teamId}/${resource}`, {
        headers: authHeaders(auth),
      });
      expect(response.status()).toBe(200);
    }

    const ownerResponse = await request.get(`/api/teams/${teamId}/users/${umamiUser.id}`, {
      headers: authHeaders(auth),
    });
    await expect(ownerResponse.json()).resolves.toMatchObject({ role: 'team-owner' });

    const addResponse = await request.post(`/api/teams/${teamId}/users`, {
      headers: authHeaders(auth),
      data: { userId, role: 'team-member' },
    });
    await expect(addResponse.json()).resolves.toMatchObject({ userId, role: 'team-member' });

    const roleResponse = await request.post(`/api/teams/${teamId}/users/${userId}`, {
      headers: authHeaders(auth),
      data: { role: 'team-view-only' },
    });
    await expect(roleResponse.json()).resolves.toMatchObject({ userId, role: 'team-view-only' });

    expect(
      (
        await request.delete(`/api/teams/${teamId}/users/${userId}`, {
          headers: authHeaders(auth),
        })
      ).status(),
    ).toBe(200);

    await deleteTeam(request, auth, teamId);
    teamId = '';
  } finally {
    if (teamId) await deleteTeam(request, auth, teamId, true);
    if (userId) await deleteUser(request, auth, userId, true);
  }
});
