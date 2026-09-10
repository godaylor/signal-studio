import { expect, test } from '@playwright/test';
import { createE2eFixtures } from './fixtures';
import { authHeaders, deleteUser, loginPage } from './helpers';

test('admin creates a unique user from the current UI', async ({ page, request }, testInfo) => {
  const auth = await loginPage(page, request);
  const fixture = createE2eFixtures(testInfo, 'ui-user');
  let userId = '';

  try {
    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: /create user/i })).toBeVisible();
    await page.getByRole('button', { name: /create user/i }).click();
    const dialog = page.getByRole('dialog', { name: /create user/i });
    await dialog.getByRole('textbox', { name: 'Username' }).fill(fixture.user.create.username);
    await dialog.getByRole('textbox', { name: 'Password' }).fill(fixture.user.create.password);
    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'User', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('link', { name: fixture.user.create.username })).toBeVisible();

    const response = await request.get('/api/admin/users', { headers: authHeaders(auth) });
    const body = await response.json();
    userId = body.data.find(item => item.username === fixture.user.create.username)?.id ?? '';
    expect(userId).not.toBe('');
  } finally {
    if (userId) await deleteUser(request, auth, userId, true);
  }
});
