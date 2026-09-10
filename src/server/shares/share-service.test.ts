import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARE_TOKEN_HEADER, SHARE_TOKEN_TYPE } from '@/lib/constants';
import { SAFE_SHARE_SCOPE } from './contracts';

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  createToken: vi.fn(),
  execute: vi.fn(),
  insightFindFirst: vi.fn(),
  parseToken: vi.fn(),
  resolveProjectAccess: vi.fn(),
  shareFindFirst: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ checkAuth: mocks.checkAuth }));
vi.mock('@/lib/crypto', () => ({ secret: () => 'unit-test-key-not-a-credential' }));
vi.mock('@/lib/jwt', () => ({ createToken: mocks.createToken, parseToken: mocks.parseToken }));
vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      share: { findFirst: mocks.shareFindFirst },
      insight: { findFirst: mocks.insightFindFirst },
      studioDashboard: { findFirst: vi.fn() },
    },
  },
}));
vi.mock('@/server/analytics/query-service', () => ({
  analysisQueryService: { execute: mocks.execute },
}));
vi.mock('@/server/permissions/capabilities', () => ({
  resolveProjectAccess: mocks.resolveProjectAccess,
}));

import {
  resolveStudioShare,
  resolveStudioShareToken,
  STUDIO_SHARE_AUDIENCE,
  STUDIO_SHARE_ISSUER,
  StudioShareNotFoundError,
} from './share-service';

const activeShare = (overrides: Record<string, unknown> = {}) => ({
  id: 'share-1',
  entityId: 'insight-1',
  projectId: 'project-1',
  shareType: 5,
  resourceType: 'insight',
  visibility: 'public',
  tokenVersion: 3,
  parameters: { version: 1 },
  scope: SAFE_SHARE_SCOPE,
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  ...overrides,
});

const request = () =>
  new Request('http://localhost/api/share/safe-link/resource', {
    headers: { [SHARE_TOKEN_HEADER]: 'share-token' },
  });

describe('M14 live share validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuth.mockResolvedValue({ user: { id: 'member-1' }, assuranceRequired: false });
    mocks.parseToken.mockReturnValue({
      type: SHARE_TOKEN_TYPE,
      shareId: 'share-1',
      tokenVersion: 3,
    });
    mocks.shareFindFirst.mockResolvedValue(activeShare());
    mocks.insightFindFirst.mockResolvedValue({
      id: 'insight-1',
      title: 'Safe aggregate',
      description: '',
      query: { version: 1 },
      visualization: {},
      updatedAt: new Date('2026-09-04T00:00:00.000Z'),
    });
    mocks.execute.mockResolvedValue({ data: { rows: [{ value: 4 }] } });
    mocks.createToken.mockReturnValue('short-lived-token');
  });

  it('checks type, audience, issuer, live record, and token version before loading data', async () => {
    const result = await resolveStudioShareToken('safe-link', request());

    expect(mocks.parseToken).toHaveBeenCalledWith('share-token', expect.any(String), {
      audience: STUDIO_SHARE_AUDIENCE,
      issuer: STUDIO_SHARE_ISSUER,
    });
    expect(mocks.shareFindFirst).toHaveBeenCalledWith({
      where: { slug: 'safe-link', id: 'share-1' },
    });
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        tenantId: 'project-1',
        permissionScope: 'public-share:aggregate:v1',
      }),
    );
    expect(result.data).toMatchObject({
      type: 'insight',
      title: 'Safe aggregate',
      result: { data: { rows: [{ value: 4 }] } },
    });
    expect(result.data).not.toHaveProperty('query');
  });

  it.each([
    ['deleted', null],
    ['expired', activeShare({ expiresAt: new Date(Date.now() - 1) })],
    ['revoked', activeShare({ revokedAt: new Date() })],
  ])('rejects an old token after the share is %s', async (_state, record) => {
    mocks.shareFindFirst.mockResolvedValue(record);
    await expect(resolveStudioShareToken('safe-link', request())).rejects.toBeInstanceOf(
      StudioShareNotFoundError,
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects a token invalidated by a scope or expiry update', async () => {
    mocks.shareFindFirst.mockResolvedValue(activeShare({ tokenVersion: 4 }));
    await expect(resolveStudioShareToken('safe-link', request())).rejects.toBeInstanceOf(
      StudioShareNotFoundError,
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('requires current workspace access for an internal share', async () => {
    mocks.resolveProjectAccess.mockResolvedValue(null);
    await expect(
      resolveStudioShare(activeShare({ visibility: 'internal' }), request()),
    ).rejects.toBeInstanceOf(StudioShareNotFoundError);
    expect(mocks.createToken).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('does not request application auth for a public aggregate share', async () => {
    const result = await resolveStudioShare(activeShare(), request());
    expect(mocks.checkAuth).not.toHaveBeenCalled();
    expect(result.token).toBe('short-lived-token');
    expect(mocks.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SHARE_TOKEN_TYPE,
        shareId: 'share-1',
        tokenVersion: 3,
      }),
      expect.any(String),
      expect.objectContaining({
        audience: STUDIO_SHARE_AUDIENCE,
        issuer: STUDIO_SHARE_ISSUER,
      }),
    );
  });
  it('rechecks membership on internal token reuse after access is revoked', async () => {
    mocks.shareFindFirst.mockResolvedValue(activeShare({ visibility: 'internal' }));
    mocks.resolveProjectAccess.mockResolvedValue(null);
    await expect(resolveStudioShareToken('safe-link', request())).rejects.toBeInstanceOf(StudioShareNotFoundError);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('rejects internal token reuse while second-factor assurance is required', async () => {
    mocks.shareFindFirst.mockResolvedValue(activeShare({ visibility: 'internal' }));
    mocks.checkAuth.mockResolvedValue({ user: { id: 'member-1' }, assuranceRequired: true });
    await expect(resolveStudioShareToken('safe-link', request())).rejects.toBeInstanceOf(StudioShareNotFoundError);
    expect(mocks.resolveProjectAccess).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
