import { expect, test } from '@playwright/test';
import { loginPage } from './helpers';

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';

test('measures the local Chromium development shell without hydration shift', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    (window as typeof window & { __studioCls: number }).__studioCls = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
      })[]) {
        if (!entry.hadRecentInput) {
          (window as typeof window & { __studioCls: number }).__studioCls += entry.value ?? 0;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await loginPage(page, request);

  await page.goto(`/studio/${projectId}/home`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const scripts = resources.filter(entry => entry.initiatorType === 'script');
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    return {
      environment: 'Next 16.3 development server; local Chromium; 1440x900; deterministic seed',
      cls: (window as typeof window & { __studioCls: number }).__studioCls,
      scriptCount: scripts.length,
      scriptEncodedBytes: scripts.reduce((total, entry) => total + entry.encodedBodySize, 0),
      domCompleteMs: navigation ? Math.round(navigation.domComplete) : null,
    };
  });

  await testInfo.attach('studio-shell-performance.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  console.info(`STUDIO_SHELL_METRICS ${JSON.stringify(metrics)}`);

  expect(metrics.cls).toBeLessThanOrEqual(0.1);
  expect(metrics.scriptCount).toBeGreaterThan(0);
  expect(metrics.scriptEncodedBytes).toBeGreaterThan(0);
});
