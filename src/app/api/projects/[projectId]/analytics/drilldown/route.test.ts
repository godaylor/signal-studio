import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { getAdvancedAnalysisMembers } from '@/server/analytics/adapters/advanced-postgresql';
import { getAnalysisAccess } from '@/server/permissions/analysis';
import { POST } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/permissions/analysis', () => ({ getAnalysisAccess: vi.fn() }));
vi.mock('@/server/analytics/adapters/advanced-postgresql', () => ({
  getAdvancedAnalysisMembers: vi.fn(),
}));

const projectId = '11111111-1111-4111-8111-111111111111';
const query = {
  version: 1,
  projectId,
  mode: 'funnel',
  range: {
    startAt: '2026-03-01T00:00:00Z',
    endAt: '2026-03-02T00:00:00Z',
    timezone: 'UTC',
    unit: 'day',
  },
  measure: { source: 'event', key: 'signup', aggregation: 'count' },
  funnel: {
    steps: [
      { type: 'event', value: 'signup', filters: [] },
      { type: 'event', value: 'active', filters: [] },
    ],
    conversionWindowMinutes: 60,
  },
  filters: [],
  match: 'all',
  comparison: 'none',
  visualization: 'bar',
};
const selection = { kind: 'funnel-step', step: 2, outcome: 'dropped' };

describe('POST /api/projects/:projectId/analytics/drilldown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseRequest).mockResolvedValue({
      auth: { user: { id: 'user-1' } },
      body: { query, selection },
      error: undefined,
    });
  });

  test('denies identity-standard access before member materialization', async () => {
    vi.mocked(getAnalysisAccess).mockResolvedValue({
      projectId,
      tenantId: 'tenant-1',
      permissionScope: 'identity-standard',
    });
    const response = await POST(new Request('http://localhost/drilldown', { method: 'POST' }), {
      params: Promise.resolve({ projectId }),
    });
    expect(response.status).toBe(403);
    expect(getAdvancedAnalysisMembers).not.toHaveBeenCalled();
  });

  test('returns bounded exact members for identity-sensitive access', async () => {
    vi.mocked(getAnalysisAccess).mockResolvedValue({
      projectId,
      tenantId: 'tenant-1',
      permissionScope: 'identity-sensitive',
    });
    vi.mocked(getAdvancedAnalysisMembers).mockResolvedValue({ total: 1, limit: 20, members: [] });
    const response = await POST(new Request('http://localhost/drilldown', { method: 'POST' }), {
      params: Promise.resolve({ projectId }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ total: 1, limit: 20, members: [] });
  });
});
