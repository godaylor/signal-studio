import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { AnalysisValidationError } from '@/server/analytics/errors';
import { analysisQueryService } from '@/server/analytics/query-service';
import { getAnalysisAccess } from '@/server/permissions/analysis';
import { POST } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/permissions/analysis', () => ({ getAnalysisAccess: vi.fn() }));
vi.mock('@/server/analytics/query-service', () => ({
  analysisQueryService: { execute: vi.fn() },
}));

const parseRequestMock = vi.mocked(parseRequest);
const getAnalysisAccessMock = vi.mocked(getAnalysisAccess);
const executeMock = vi.mocked(analysisQueryService.execute);
const projectId = '11111111-1111-4111-8111-111111111111';
const body = { version: 1, projectId };

function request() {
  return new Request(`http://localhost/api/projects/${projectId}/analytics/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': 'request-42' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/projects/:projectId/analytics/query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseRequestMock.mockResolvedValue({
      auth: { user: { id: 'user-1', isAdmin: false } },
      body,
      error: undefined,
    });
  });

  test('denies access before the query service or cache boundary', async () => {
    getAnalysisAccessMock.mockResolvedValue(null);

    const response = await POST(request(), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(403);
    expect(executeMock).not.toHaveBeenCalled();
  });

  test('passes only authorized tenant and permission scope to the service', async () => {
    getAnalysisAccessMock.mockResolvedValue({
      projectId,
      tenantId: 'workspace-1',
      permissionScope: 'identity-standard',
    });
    executeMock.mockResolvedValue({ queryVersion: 1, data: { rows: [] } } as never);

    const req = request();
    const response = await POST(req, { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith({
      query: body,
      projectId,
      tenantId: 'workspace-1',
      permissionScope: 'identity-standard',
      requestId: 'request-42',
      signal: req.signal,
    });
  });

  test('maps actionable planner errors to a safe 400 envelope', async () => {
    getAnalysisAccessMock.mockResolvedValue({
      projectId,
      tenantId: 'workspace-1',
      permissionScope: 'identity-standard',
    });
    executeMock.mockRejectedValue(
      new AnalysisValidationError('analysis-range-too-large', 'Range is too large.', {
        path: ['range'],
        hint: 'Shorten the date range.',
      }),
    );

    const response = await POST(request(), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'analysis-range-too-large',
        message: 'Range is too large.',
        details: { path: ['range'], hint: 'Shorten the date range.' },
      },
    });
  });
});
