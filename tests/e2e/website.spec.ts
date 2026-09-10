import { expect, test } from '@playwright/test';
import { createE2eFixtures } from './fixtures';
import { deleteWebsite, loginPage } from './helpers';

test('website UI creates, edits and deletes unique retry-safe state', async ({
  page,
  request,
}, testInfo) => {
  const auth = await loginPage(page, request);
  const fixture = createE2eFixtures(testInfo, 'ui-website');
  let websiteId = '';

  try {
    await page.goto('/websites');
    await page.getByRole('button', { name: /add website/i }).click();
    await expect(page.getByRole('dialog', { name: /add website/i })).toBeVisible();
    await page.getByTestId('input-name').locator('input').fill(fixture.website.create.name);
    await page.getByTestId('input-domain').locator('input').fill(fixture.website.create.domain);
    await page.getByTestId('button-submit').click();

    const row = page.getByRole('row').filter({ hasText: fixture.website.create.name });
    await expect(row).toContainText(fixture.website.create.domain);
    const settingsLink = row.locator('a[href*="/websites/"][href$="/settings"]');
    websiteId = (await settingsLink.getAttribute('href'))?.match(/\/websites\/([^/]+)/)?.[1] ?? '';
    expect(websiteId).not.toBe('');
    await settingsLink.click();

    await page.getByRole('textbox', { name: 'Name' }).fill(fixture.website.update.name);
    await page.getByRole('textbox', { name: 'Domain' }).fill(fixture.website.update.domain);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
      fixture.website.update.name,
    );

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Confirm' }).fill('DELETE');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/websites$/);
    websiteId = '';
  } finally {
    if (websiteId) await deleteWebsite(request, auth, websiteId, true);
  }
});
