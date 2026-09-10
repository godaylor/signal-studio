import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createE2eFixtures } from './fixtures';
import { authHeaders, deleteTeam, deleteWebsite, loginViaApi } from './helpers';

test('website API CRUD owns and cleans unique retry-safe state', async ({ request }, testInfo) => {
  const auth = await loginViaApi(request);
  const fixture = createE2eFixtures(testInfo, 'api-website');
  let teamId = '';
  const websiteIds = new Set<string>();

  try {
    const teamResponse = await request.post('/api/teams', {
      headers: authHeaders(auth),
      data: fixture.team.create,
    });
    expect(teamResponse.status()).toBe(200);
    teamId = (await teamResponse.json())[0].id;

    const createResponse = await request.post('/api/websites', {
      headers: authHeaders(auth),
      data: fixture.website.create,
    });
    const created = await createResponse.json();
    expect(createResponse.status()).toBe(200);
    websiteIds.add(created.id);
    expect(created).toMatchObject(fixture.website.create);

    const teamWebsiteResponse = await request.post('/api/websites', {
      headers: authHeaders(auth),
      data: {
        name: `${fixture.website.create.name} team`,
        domain: `team-${fixture.website.create.domain}`,
        teamId,
      },
    });
    expect(teamWebsiteResponse.status()).toBe(200);
    websiteIds.add((await teamWebsiteResponse.json()).id);

    const fixedId = randomUUID();
    const fixedResponse = await request.post('/api/websites', {
      headers: authHeaders(auth),
      data: { ...fixture.website.create, id: fixedId },
    });
    expect(fixedResponse.status()).toBe(200);
    websiteIds.add(fixedId);

    const listResponse = await request.get('/api/websites', { headers: authHeaders(auth) });
    expect(listResponse.status()).toBe(200);
    expect((await listResponse.json()).data.some(item => item.id === created.id)).toBe(true);

    const getResponse = await request.get(`/api/websites/${created.id}`, {
      headers: authHeaders(auth),
    });
    await expect(getResponse.json()).resolves.toMatchObject(fixture.website.create);

    const updateResponse = await request.post(`/api/websites/${created.id}`, {
      headers: authHeaders(auth),
      data: fixture.website.update,
    });
    await expect(updateResponse.json()).resolves.toMatchObject(fixture.website.update);

    const shareResponse = await request.post(`/api/websites/${created.id}`, {
      headers: authHeaders(auth),
      data: { shareId: `PW${testInfo.retry}${testInfo.workerIndex}` },
    });
    expect(shareResponse.status()).toBe(200);

    const resetResponse = await request.post(`/api/websites/${created.id}/reset`, {
      headers: authHeaders(auth),
    });
    await expect(resetResponse.json()).resolves.toMatchObject({ ok: true });

    for (const websiteId of websiteIds) {
      await deleteWebsite(request, auth, websiteId);
    }
    websiteIds.clear();
  } finally {
    for (const websiteId of websiteIds) {
      await deleteWebsite(request, auth, websiteId, true);
    }
    if (teamId) await deleteTeam(request, auth, teamId, true);
  }
});
