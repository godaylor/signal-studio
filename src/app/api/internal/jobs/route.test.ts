import { afterEach, expect, test, vi } from 'vitest';
const run = vi.hoisted(() => vi.fn());
vi.mock('@/server/jobs/serverless', () => ({ runServerlessJobs: run }));
import { POST } from './route';
afterEach(() => {
  vi.unstubAllEnvs();
  run.mockReset();
});

test('cron cannot run without explicitly enabled mode and a strong matching secret', async () => {
  vi.stubEnv('SIGNAL_STUDIO_SERVERLESS', '1');
  vi.stubEnv('JOBS_CRON_SECRET', 'secret');
  expect(
    (
      await POST(
        new Request('https://studio.test/api/internal/jobs', {
          method: 'POST',
          headers: { authorization: 'Bearer secret' },
        }),
      )
    ).status,
  ).toBe(401);
  vi.stubEnv('JOBS_CRON_SECRET', 'x'.repeat(40));
  expect(
    (await POST(new Request('https://studio.test/api/internal/jobs', { method: 'POST' }))).status,
  ).toBe(401);
  expect(run).not.toHaveBeenCalled();
});

test('authenticated cron runs the bounded batch and masks dependency errors', async () => {
  vi.stubEnv('SIGNAL_STUDIO_SERVERLESS', '1');
  vi.stubEnv('JOBS_CRON_SECRET', 'x'.repeat(40));
  const request = () =>
    new Request('https://studio.test/api/internal/jobs', {
      method: 'POST',
      headers: { authorization: `Bearer ${'x'.repeat(40)}` },
    });
  expect((await POST(request())).status).toBe(200);
  expect(run).toHaveBeenCalledWith('cron');
  run.mockRejectedValueOnce(new Error('private database details'));
  const result = await POST(request());
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain('private database');
});
