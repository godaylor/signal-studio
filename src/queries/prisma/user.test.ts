import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getUserByUsername, updateUser } from './user';

const { findUniqueMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      user: {
        findUnique: findUniqueMock,
        update: updateMock,
      },
    },
  },
}));

describe('getUserByUsername', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue(null);
  });

  test('normalizes usernames to lowercase before lookup', async () => {
    await getUserByUsername('KaKi87', { includePassword: true });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        username: 'kaki87',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        password: true,
        sessionVersion: false,
        role: true,
        createdAt: true,
        twoFactorRequired: true,
      },
    });
  });

  test('can include deleted users while still lowercasing the username', async () => {
    await getUserByUsername('KaKi87', { showDeleted: true });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        username: 'kaki87',
      },
      select: {
        id: true,
        username: true,
        password: false,
        sessionVersion: false,
        role: true,
        createdAt: true,
        twoFactorRequired: true,
      },
    });
  });
});

describe('updateUser session revocation', () => {
  beforeEach(() => {
    updateMock.mockReset();
  });

  test('increments session version whenever a password is changed', async () => {
    await updateUser('user-1', { password: 'new-password-hash' });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: {
          password: 'new-password-hash',
          sessionVersion: { increment: 1 },
        },
      }),
    );
  });

  test('does not revoke sessions for unrelated profile updates', async () => {
    await updateUser('user-1', { displayName: 'Alice' });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { displayName: 'Alice' } }),
    );
  });
});
