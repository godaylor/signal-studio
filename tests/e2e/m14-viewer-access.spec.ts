import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { hashPassword } from '../../src/lib/password';
import prisma from '../../src/lib/prisma';

const viewerPassword = randomBytes(32).toString('base64url');
const ids = {
  viewer: randomUUID(),
  workspace: randomUUID(),
  project: randomUUID(),
  membership: randomUUID(),
};
const viewerUsername = `m14-viewer-${ids.viewer}`;

test.beforeAll(async () => {
  await prisma.client.user.create({
    data: {
      id: ids.viewer,
      username: viewerUsername,
      password: hashPassword(viewerPassword),
      role: 'user',
    },
  });
  await prisma.client.team.create({
    data: { id: ids.workspace, name: `M14 Viewer ${ids.workspace.slice(0, 8)}` },
  });
  await prisma.client.website.create({
    data: {
      id: ids.project,
      name: 'M14 Viewer project',
      domain: `m14-viewer-${ids.project}.example`,
      teamId: ids.workspace,
    },
  });
  await prisma.client.teamUser.create({
    data: {
      id: ids.membership,
      teamId: ids.workspace,
      userId: ids.viewer,
      role: 'team-view-only',
      studioRole: 'viewer',
      capabilityOverrides: {},
    },
  });
});

test.afterAll(async () => {
  await prisma.client.securityAuditEvent.deleteMany({ where: { actorUserId: ids.viewer } });
  await prisma.client.teamUser.deleteMany({ where: { id: ids.membership } });
  await prisma.client.website.deleteMany({ where: { id: ids.project } });
  await prisma.client.team.deleteMany({ where: { id: ids.workspace } });
  await prisma.client.user.deleteMany({ where: { id: ids.viewer } });
  await prisma.client.$disconnect();
});

const query = {
  version: 1,
  projectId: ids.project,
  mode: 'trend',
  range: {
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: '2026-01-08T00:00:00.000Z',
    timezone: 'UTC',
    unit: 'day',
  },
  measure: { source: 'event', key: 'pageview', aggregation: 'count' },
  filters: [],
  match: 'all',
  comparison: 'none',
  visualization: 'line',
};

test('Viewer login exposes aggregate navigation and server-enforces restricted capabilities', async ({
  page,
  request,
}) => {
  await page.goto('/login?locale=en-US');
  await page.getByTestId('input-username').locator('input').fill(viewerUsername);
  await page.getByTestId('input-password').locator('input').fill(viewerPassword);
  const loginResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
  );
  await page.getByTestId('button-submit').click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);
  const login = await loginResponse.json();
  expect(login.user).toMatchObject({ id: ids.viewer, username: viewerUsername, isAdmin: false });
  const headers = { Authorization: `Bearer ${login.token}` };

  await page.goto(`/studio/${ids.project}/home`);
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  const navigation = page.locator('aside').getByRole('navigation', { name: 'Primary' });
  await expect(navigation.getByRole('link')).toHaveText(['Home', 'Explore', 'Dashboards', 'Live']);
  await expect(navigation.getByRole('link', { name: 'Audiences' })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Experience' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sources' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Workspace settings' })).toHaveCount(0);

  let identityRequests = 0;
  page.on('request', browserRequest => {
    if (/\/(tracked-users|accounts|evidence)(\/|\?|$)/.test(browserRequest.url())) {
      identityRequests += 1;
    }
  });
  await page.goto(`/studio/${ids.project}/audiences`);
  await expect(page.getByRole('heading', { name: 'Insufficient permissions' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(identityRequests).toBe(0);

  const accessResponse = await request.get(`/api/projects/${ids.project}/access`, { headers });
  expect(accessResponse.status()).toBe(200);
  await expect(accessResponse.json()).resolves.toEqual({
    data: {
      projectId: ids.project,
      workspaceId: ids.workspace,
      studioRole: 'viewer',
      capabilities: {
        manageWorkspaceSecurity: false,
        manageMembers: false,
        manageSources: false,
        editInsights: false,
        editDashboards: false,
        createSegments: false,
        viewAggregate: true,
        viewIdentity: false,
        viewSensitiveTraits: false,
        viewReplay: false,
        exportData: false,
        createPublicShare: false,
      },
      permissionScope: 'aggregate-only',
      isSystemAdmin: false,
      isDirectOwner: false,
    },
  });

  const aggregateResponse = await request.post(`/api/projects/${ids.project}/analytics/query`, {
    headers,
    data: query,
  });
  expect(aggregateResponse.status()).toBe(200);

  const deniedRequests = [
    request.get(`/api/projects/${ids.project}/members`, { headers }),
    request.get(`/api/projects/${ids.project}/shares`, { headers }),
    request.get(`/api/projects/${ids.project}/tracked-users`, { headers }),
    request.get(
      `/api/websites/${ids.project}/export?startAt=1767225600000&endAt=1767830400000&unit=day&timezone=UTC`,
      { headers },
    ),
  ];
  const deniedResponses = await Promise.all(deniedRequests);
  expect(deniedResponses.map(response => response.status())).toEqual([403, 403, 403, 403]);
  await expect(Promise.all(deniedResponses.map(response => response.json()))).resolves.toEqual([
    expect.objectContaining({
      error: expect.objectContaining({ code: 'workspace-member-access-denied' }),
    }),
    expect.objectContaining({
      error: expect.objectContaining({ code: 'studio-share-access-denied' }),
    }),
    expect.objectContaining({
      error: expect.objectContaining({ code: 'project-identity-access-denied' }),
    }),
    expect.objectContaining({
      error: expect.objectContaining({ code: 'project-export-access-denied' }),
    }),
  ]);
});
