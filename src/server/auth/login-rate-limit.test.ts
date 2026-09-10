import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  txFindUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      loginRateLimit: {
        findUnique: mocks.findUnique,
        deleteMany: mocks.deleteMany,
      },
    },
    transaction: mocks.transaction,
  },
}));

import {
  checkLoginRateLimit,
  getLoginRateLimitKey,
  recordLoginFailure,
  resetLoginRateLimit,
} from './login-rate-limit';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', '5');
  vi.stubEnv('LOGIN_RATE_LIMIT_WINDOW_SECONDS', '900');
  vi.stubEnv('LOGIN_RATE_LIMIT_RETENTION_SECONDS', '86400');
  vi.stubEnv('CLIENT_IP_HEADER', '');
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  mocks.transaction.mockImplementation(callback =>
    callback({ loginRateLimit: { findUnique: mocks.txFindUnique, upsert: mocks.upsert } }),
  );
});

test('locks only the targeted key after the deterministic failure limit', async () => {
  const now = new Date('2026-08-27T12:00:00.000Z');
  let record: any = null;
  mocks.txFindUnique.mockImplementation(() => record);
  mocks.upsert.mockImplementation(({ create, update }) => {
    record = record ? { ...record, ...update } : { ...create };
    return record;
  });

  for (let attempt = 1; attempt <= 4; attempt++) {
    await expect(recordLoginFailure('key-a', now)).resolves.toBeNull();
  }

  const lockedUntil = await recordLoginFailure('key-a', now);

  expect(lockedUntil).toEqual(new Date('2026-08-27T12:15:00.000Z'));
  expect(mocks.transaction).toHaveBeenCalledTimes(5);
});

test('reports a safe retry interval for a locked key', async () => {
  mocks.findUnique.mockResolvedValue({
    lockedUntil: new Date('2026-08-27T12:02:00.000Z'),
  });

  await expect(checkLoginRateLimit('key-a', new Date('2026-08-27T12:00:30.000Z'))).resolves.toEqual(
    { allowed: false, retryAfterSeconds: 90 },
  );
});

test('reset affects one key and does not require Redis or a global lock', async () => {
  await resetLoginRateLimit('key-a');

  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { key: 'key-a' } });
});

test('spoofed proxy headers cannot rotate the direct-deployment rate key', () => {
  const first = getLoginRateLimitKey(
    new Request('http://localhost/login', { headers: { 'x-forwarded-for': '1.2.3.4' } }),
    'Alice',
  );
  const second = getLoginRateLimitKey(
    new Request('http://localhost/login', { headers: { 'x-forwarded-for': '5.6.7.8' } }),
    'alice',
  );

  expect(first).toBe(second);
});

test('configured trusted proxy header contributes to the per-client rate key', () => {
  vi.stubEnv('CLIENT_IP_HEADER', 'x-forwarded-for');

  const first = getLoginRateLimitKey(
    new Request('http://localhost/login', { headers: { 'x-forwarded-for': '1.2.3.4' } }),
    'alice',
  );
  const second = getLoginRateLimitKey(
    new Request('http://localhost/login', { headers: { 'x-forwarded-for': '5.6.7.8' } }),
    'alice',
  );

  expect(first).not.toBe(second);
});

test('opportunistically removes rows older than the bounded retention window', async () => {
  mocks.txFindUnique.mockResolvedValue(null);

  await recordLoginFailure('key-a', new Date('2026-08-27T12:00:00.000Z'));

  expect(mocks.deleteMany).toHaveBeenCalledWith({
    where: { updatedAt: { lt: new Date('2026-08-26T12:00:00.000Z') } },
  });
});
