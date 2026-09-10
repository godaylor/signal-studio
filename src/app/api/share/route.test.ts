import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canUpdateEntity: vi.fn(),
  parseRequest: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/permissions', () => ({ canUpdateEntity: mocks.canUpdateEntity }));

import { POST } from './route';

describe('POST /api/share legacy compatibility boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseRequest.mockResolvedValue({
      auth: { user: { id: 'user-1' } },
      body: {
        entityId: '11111111-1111-4111-8111-111111111111',
        shareType: 1,
        name: 'Legacy share',
        parameters: {},
      },
      error: null,
    });
    mocks.canUpdateEntity.mockResolvedValue(true);
  });

  it('keeps the legacy endpoint readable but rejects creation of a new legacy share', async () => {
    const response = await POST(
      new Request('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'legacy-share-creation-disabled' },
    });
  });

  it('does not reveal the product boundary to an unauthorized actor', async () => {
    mocks.canUpdateEntity.mockResolvedValue(false);
    const response = await POST(new Request('http://localhost/api/share', { method: 'POST' }));
    expect(response.status).toBe(401);
  });
});
