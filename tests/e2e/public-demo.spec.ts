import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('public demo completes without authentication or project API access', async ({ page }) => {
  const projectRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/projects/')) projectRequests.push(request.url());
  });
  await page.goto('/login?locale=ru-RU');
  await page.getByRole('link', { name: 'Попробовать демо' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/Данные production не читаются/)).toBeVisible();
  await page.getByRole('button', { name: 'События', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('signup');
  await page.getByRole('button', { name: 'Анализ', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('120');
  await page.getByRole('button', { name: 'Сохранённый анализ', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить анализ в демо' }).click();
  await page.getByRole('button', { name: 'Дашборд', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить сохранённый анализ' }).click();
  await expect(page.getByText('40%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Аудитория', exact: true }).click();
  await page.getByRole('button', { name: 'Посмотреть аудиторию демо' }).click();
  await expect(page.getByRole('status')).toContainText('36 вымышленных');
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать JSON демо' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('signal-studio-demo.json');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.demo).toBe(true);
  expect(exported.rows.map(row => row.users)).toEqual([120, 84, 48]);
  expect(exported.audience.users).toBe(36);
  expect(projectRequests).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: 'Дашборд', exact: true }).click();
  await expect(page.getByText('Сначала сохраните анализ на шаге 4.')).toBeVisible();
});

for (const width of [1280, 390]) {
  test(`public demo accessibility and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo?locale=ru-RU');
    await page.getByRole('button', { name: 'Анализ', exact: true }).click();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Анализ', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Сохранённый анализ', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Сохранённый анализ', exact: true })).toBeVisible();
  });
}
