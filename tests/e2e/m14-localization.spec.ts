import { expect, test } from '@playwright/test';

test('public auth exposes only RU/EN and persists the selected locale', async ({ page }) => {
  await page.goto('/login?locale=fr-FR');

  await expect(page).toHaveTitle(/Signal Studio/);
  await expect(page.getByRole('heading', { name: 'Signal Studio' })).toBeVisible();
  await expect(page.getByText('Имя пользователя', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Выбрать язык' }).click();
  await expect(page.getByRole('button', { name: /^RU — Русский$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^EN — English \(US\)$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(RU|EN) —/ })).toHaveCount(2);
  await page.getByRole('button', { name: /^EN — English \(US\)$/ }).click();

  await expect(page.getByText('Username', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select language' })).toContainText('EN');

  await page.goto('/login');
  await expect(page.getByText('Username', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select language' })).toContainText('EN');

  await page.reload();
  await expect(page.getByText('Username', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Select language' }).click();
  await page.getByRole('button', { name: /^RU — Русский$/ }).click();
  await page.reload();

  await expect(page.getByText('Имя пользователя', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выбрать язык' })).toContainText('RU');
});
