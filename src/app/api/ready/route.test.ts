import { beforeEach, expect, test, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { GET } from './route';

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      $queryRaw: vi.fn(),
    },
  },
}));

const prismaMock = vi.mocked(prisma, true);

beforeEach(() => {
  prismaMock.client.$queryRaw.mockReset();
});

test('reports ready when PostgreSQL responds', async () => {
  prismaMock.client.$queryRaw.mockResolvedValue([{ version: 150000, migrated: true }] as never);

  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    dependencies: { database: 'ready' },
  });
});

test('reports unavailable without exposing the dependency error', async () => {
  prismaMock.client.$queryRaw.mockRejectedValue(new Error('postgresql://secret@database'));

  const response = await GET();

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    error: {
      message: 'Service unavailable',
      code: 'database-unavailable',
      status: 503,
      dependencies: { database: 'unavailable' },
    },
  });
});

test('rejects responding PostgreSQL with incomplete migrations', async () => {
  prismaMock.client.$queryRaw.mockResolvedValue([{ version: 150000, migrated: false }] as never);
  const response = await GET();
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe('database-schema-not-ready');
});
