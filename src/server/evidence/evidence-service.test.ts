import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  deriveExperienceCapabilities,
  getEvidenceReplay,
  getSessionEvidence,
  ReplayEvidenceForbiddenError,
} from './evidence-service';

const mocks = vi.hoisted(() => ({
  sessionFindFirst: vi.fn(),
  trackedUserFindFirst: vi.fn(),
  websiteFindFirst: vi.fn(),
  replayFindFirst: vi.fn(),
  getReplayChunks: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      session: { findFirst: mocks.sessionFindFirst },
      trackedUser: { findFirst: mocks.trackedUserFindFirst },
      website: { findFirst: mocks.websiteFindFirst },
      sessionReplay: { findFirst: mocks.replayFindFirst },
    },
  },
}));

vi.mock('@/queries/sql', () => ({ getReplayChunks: mocks.getReplayChunks }));

const projectId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const event = {
  id: '33333333-3333-4333-8333-333333333333',
  createdAt: new Date('2026-03-02T10:00:00.000Z'),
  eventName: 'core_feature_used',
  eventType: 2,
  urlPath: '/workspace',
  pageTitle: 'Private workspace',
  lcp: 1200,
  inp: 80,
  cls: 0.05,
  fcp: 700,
  ttfb: 120,
  eventData: [{ dataKey: 'plan', stringValue: 'enterprise', numberValue: null, dateValue: null }],
};

describe('Experience evidence service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionFindFirst.mockResolvedValue({
      id: sessionId,
      distinctId: 'alice',
      browser: 'Chrome',
      os: 'Windows',
      device: 'desktop',
      country: 'DE',
      createdAt: new Date('2026-03-02T09:00:00.000Z'),
      websiteEvents: [event],
    });
    mocks.trackedUserFindFirst.mockResolvedValue({
      id: 'user-1',
      externalId: 'alice',
      displayName: 'Alice',
      traits: { plan: 'enterprise' },
      sensitiveTraits: { email: 'alice@example.test' },
      membership: {
        account: { id: 'account-1', externalId: 'acme', name: 'Acme' },
      },
    });
    mocks.websiteFindFirst.mockResolvedValue({
      replayConfig: { replayEnabled: true, maskLevel: 'strict' },
    });
    mocks.replayFindFirst.mockResolvedValue({
      visitId: 'visit-1',
      startedAt: new Date('2026-03-02T09:00:00.000Z'),
      endedAt: new Date('2026-03-02T09:10:00.000Z'),
      eventCount: 3,
    });
  });

  test('masks sensitive identity and event text while denying replay for standard scope', async () => {
    const result = await getSessionEvidence({
      projectId,
      scope: 'identity-standard',
      query: { sessionId, limit: 50 },
    });
    expect(result.identity).toMatchObject({ label: 'Tracked user user-1' });
    expect(result.identity).not.toHaveProperty('externalId');
    expect(result.timeline.data[0]).toMatchObject({ pageTitle: null, properties: [] });
    expect(result.replay.state).toBe('permission-denied');
    expect(mocks.replayFindFirst).not.toHaveBeenCalled();
  });

  test('returns properties, performance and explicit replay availability for sensitive scope', async () => {
    const result = await getSessionEvidence({
      projectId,
      scope: 'identity-sensitive',
      query: { sessionId, limit: 50, urlPath: '/workspace' },
    });
    expect(result.identity).toMatchObject({ label: 'Alice', externalId: 'alice' });
    expect(result.timeline.data[0]).toMatchObject({
      pageTitle: 'Private workspace',
      properties: [{ key: 'plan', value: 'enterprise' }],
    });
    expect(result.performance).toMatchObject({ lcp: 1200, inp: 80, cls: 0.05 });
    expect(result.replay).toMatchObject({ state: 'available', replayId: 'visit-1' });
    expect(result.compatibleContext.urlPath).toBe('/workspace');
  });

  test('enforces replay as a separate capability and bounds chunk retrieval', async () => {
    expect(deriveExperienceCapabilities('identity-standard').canViewReplay).toBe(false);
    await expect(
      getEvidenceReplay(projectId, 'visit-1', 'identity-standard'),
    ).rejects.toBeInstanceOf(ReplayEvidenceForbiddenError);
    mocks.getReplayChunks.mockResolvedValue([{ events: [{ type: 4, data: {} }] }]);
    await getEvidenceReplay(projectId, 'visit-1', 'identity-sensitive');
    expect(mocks.getReplayChunks).toHaveBeenCalledWith(projectId, 'visit-1', {
      endChunkIndex: 49,
    });
  });
});
