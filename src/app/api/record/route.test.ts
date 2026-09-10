import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CACHE_TOKEN_TYPE } from '@/lib/constants';
import { hash } from '@/lib/crypto';
import { getClientInfo } from '@/lib/detect';
import { parseToken } from '@/lib/jwt';
import { parseRequest } from '@/lib/request';
import { getWebsite } from '@/queries/prisma';
import { saveRecording } from '@/queries/sql';
import { OPTIONS, POST } from './route';

vi.mock('@/server/lifecycle/ingestion', () => ({ withLifecycleIngestion: (_projectId: string, action: () => Promise<Response>) => action() }));

vi.mock('@/lib/detect', () => ({
  getClientInfo: vi.fn(),
  hasBlockedIp: vi.fn(),
}));

vi.mock('@/lib/jwt', () => ({
  parseToken: vi.fn(),
}));

vi.mock('@/lib/request', () => ({
  parseRequest: vi.fn(),
}));

vi.mock('@/queries/prisma', () => ({
  getWebsite: vi.fn(),
}));

vi.mock('@/queries/sql', () => ({
  saveRecording: vi.fn(),
}));

vi.mock('@/queries/sql/heatmap/saveHeatmapEvents', () => ({
  saveHeatmapEvents: vi.fn(),
}));

const parseRequestMock = vi.mocked(parseRequest);
const parseTokenMock = vi.mocked(parseToken);
const getClientInfoMock = vi.mocked(getClientInfo);
const getWebsiteMock = vi.mocked(getWebsite);
const saveRecordingMock = vi.mocked(saveRecording);

const WEBSITE_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_IP = '203.0.113.10';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function recordRequest() {
  parseRequestMock.mockResolvedValue({
    body: {
      type: 'record',
      payload: {
        website: WEBSITE_ID,
        events: [{ timestamp: 1_700_000_000_000 }],
      },
    },
    error: undefined,
  });

  return new Request('http://localhost/api/record', {
    method: 'POST',
    headers: { 'x-umami-cache': 'cache-token' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getClientInfoMock.mockResolvedValue({ ip: CLIENT_IP, userAgent: USER_AGENT } as any);
  getWebsiteMock.mockResolvedValue({
    id: WEBSITE_ID,
    recorderEnabled: true,
    replayConfig: { replayEnabled: true },
  } as any);
  saveRecordingMock.mockResolvedValue(undefined as any);
});

describe('record route CORS', () => {
  test('handles preflight requests', async () => {
    const response = OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('x-umami-cache');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  test('includes CORS headers on post responses', async () => {
    parseRequestMock.mockResolvedValue({
      body: {
        type: 'record',
        payload: {
          website: '11111111-1111-4111-8111-111111111111',
          events: [],
        },
      },
      error: undefined,
    });

    const response = await POST(
      new Request('http://localhost/api/record', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('record cache token binding', () => {
  test('rejects a cache token minted for another website', async () => {
    parseTokenMock.mockReturnValue({
      type: CACHE_TOKEN_TYPE,
      websiteId: '22222222-2222-4222-8222-222222222222',
      sessionId: 'session-1',
      visitId: 'visit-1',
      context: 'context',
    } as any);

    const response = await POST(recordRequest());

    expect(response.status).toBe(400);
    expect(saveRecordingMock).not.toHaveBeenCalled();
  });

  test('rejects a token replayed from another client session context', async () => {
    parseTokenMock.mockReturnValue({
      type: CACHE_TOKEN_TYPE,
      websiteId: WEBSITE_ID,
      sessionId: 'session-1',
      visitId: 'visit-1',
      context: 'wrong-context',
    } as any);

    const response = await POST(recordRequest());

    expect(response.status).toBe(400);
    expect(saveRecordingMock).not.toHaveBeenCalled();
  });

  test('accepts the bound token for its website and client context', async () => {
    parseTokenMock.mockReturnValue({
      type: CACHE_TOKEN_TYPE,
      websiteId: WEBSITE_ID,
      sessionId: 'session-1',
      visitId: 'visit-1',
      context: hash('collection-context', WEBSITE_ID, CLIENT_IP, USER_AGENT),
    } as any);

    const response = await POST(recordRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(saveRecordingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteId: WEBSITE_ID,
        sessionId: 'session-1',
        visitId: 'visit-1',
      }),
    );
  });
});
