import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginPage } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';

test.beforeEach(async ({ page, request }) => {
  await loginPage(page, request);
});

test('flagship Studio shell has no serious or critical WCAG 2.2 AA violations', async ({
  page,
}) => {
  for (const scenario of [
    { path: `/studio/${projectId}/home`, width: 1440, height: 900 },
    { path: `/studio/${projectId}/explore`, width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(scenario.path);
    await expect(page.getByRole('main')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const blockingViolations = results.violations.filter(violation =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    );

    expect(blockingViolations, `${scenario.path} accessibility violations`).toEqual([]);
  }
});
