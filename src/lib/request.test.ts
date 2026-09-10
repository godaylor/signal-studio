import { beforeEach, expect, test, vi } from 'vitest';
import { checkAuth } from '@/lib/auth';
import { withDateRange } from '@/lib/schema';
import { getQueryFilters, getRequestDateRange, parseRequest } from './request';

vi.mock('@/lib/auth', () => ({ checkAuth: vi.fn() }));
const checkAuthMock = vi.mocked(checkAuth);

beforeEach(() => {
  checkAuthMock.mockReset();
});

test('blocks a direct API request when server-side 2FA assurance is missing', async () => {
  checkAuthMock.mockResolvedValue({
    user: { id: 'user-1' },
    assuranceRequired: true,
  } as any);

  const result = await parseRequest(new Request('http://localhost/api/websites'));
  const response = result.error?.();

  expect(response?.status).toBe(403);
  await expect(response?.json()).resolves.toMatchObject({
    error: { code: 'two-factor-assurance-required' },
  });
});

test('allows a restricted session to complete the 2FA setup flow', async () => {
  checkAuthMock.mockResolvedValue({
    user: { id: 'user-1' },
    assuranceRequired: true,
  } as any);

  const result = await parseRequest(
    new Request('http://localhost/api/2fa/setup/initiate', { method: 'POST' }),
  );

  expect(result.error).toBeUndefined();
  expect(result.auth.user.id).toBe('user-1');
});

test('allows normal management access after assurance succeeds', async () => {
  checkAuthMock.mockResolvedValue({
    user: { id: 'user-1' },
    assuranceRequired: false,
  } as any);

  const result = await parseRequest(new Request('http://localhost/api/websites'));

  expect(result.error).toBeUndefined();
});

test('normalizes the legacy startDate/endDate parser output instead of producing invalid dates', () => {
  const range = getRequestDateRange({
    startDate: new Date('2026-03-08T05:00:00.000Z'),
    endDate: new Date('2026-03-09T04:00:00.000Z'),
    timezone: 'America/New_York',
    unit: 'hour',
  });

  expect(range).toEqual({
    startDate: new Date('2026-03-08T05:00:00.000Z'),
    endDate: new Date('2026-03-09T04:00:00.000Z'),
    timezone: 'America/New_York',
    unit: 'hour',
  });
});

test('defaults an explicit UTC timezone and rejects reversed ranges', () => {
  expect(getRequestDateRange({ startAt: 0, endAt: 1_000 }).timezone).toBe('UTC');
  expect(getRequestDateRange({})).toEqual({
    startDate: undefined,
    endDate: undefined,
    timezone: 'UTC',
    unit: undefined,
  });
  expect(() => getRequestDateRange({ startAt: 1_000, endAt: 1_000 })).toThrow('start before end');
});

test('normalizes explicit-offset instants across the 23-hour spring DST interval', () => {
  const range = getRequestDateRange({
    startDate: '2026-03-08T00:00:00-05:00',
    endDate: '2026-03-09T00:00:00-04:00',
    timezone: 'America/New_York',
  });

  expect(range.timezone).toBe('America/New_York');
  expect(range.endDate.getTime() - range.startDate.getTime()).toBe(23 * 60 * 60 * 1_000);
});

test('normalizes explicit-offset instants across the 25-hour fall DST interval', () => {
  const range = getRequestDateRange({
    startDate: '2026-11-01T00:00:00-04:00',
    endDate: '2026-11-02T00:00:00-05:00',
    timezone: 'America/New_York',
  });

  expect(range.timezone).toBe('America/New_York');
  expect(range.endDate.getTime() - range.startDate.getTime()).toBe(25 * 60 * 60 * 1_000);
});

test('rejects offsetless wall-clock strings instead of applying implicit parser timezone magic', () => {
  expect(() =>
    getRequestDateRange({
      startDate: '2026-03-08T00:00:00',
      endDate: '2026-03-09T00:00:00',
      timezone: 'America/New_York',
    }),
  ).toThrow('explicit timezone offset');
});

test('validates raw API date boundaries before parseRequest coercion and query normalization', async () => {
  const offsetless = await parseRequest(
    new Request(
      'http://localhost/api/reports?startDate=2026-03-08T00%3A00%3A00&endDate=2026-03-09T00%3A00%3A00&timezone=America%2FNew_York',
    ),
    withDateRange(),
    { skipAuth: true },
  );

  expect(offsetless.error?.().status).toBe(400);

  const explicitOffset = await parseRequest(
    new Request(
      'http://localhost/api/reports?startDate=2026-03-08T00%3A00%3A00-05%3A00&endDate=2026-03-09T00%3A00%3A00-04%3A00&timezone=America%2FNew_York',
    ),
    withDateRange(),
    { skipAuth: true },
  );

  expect(explicitOffset.error).toBeUndefined();
  await expect(getQueryFilters(explicitOffset.query)).resolves.toMatchObject({
    startDate: new Date('2026-03-08T05:00:00.000Z'),
    endDate: new Date('2026-03-09T04:00:00.000Z'),
    timezone: 'America/New_York',
  });

  const parsedDates = withDateRange().parse({
    startDate: new Date('2026-11-01T04:00:00.000Z'),
    endDate: new Date('2026-11-02T05:00:00.000Z'),
    timezone: 'America/New_York',
  });

  await expect(getQueryFilters(parsedDates)).resolves.toMatchObject({
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    timezone: 'America/New_York',
  });
});
