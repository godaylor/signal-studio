import { beforeEach, describe, expect, test, vi } from 'vitest';
import { upsertTrackedIdentity } from './upsert';

const { writeRawQueryMock } = vi.hoisted(() => ({
  writeRawQueryMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    writeRawQuery: writeRawQueryMock,
  },
}));

describe('upsertTrackedIdentity', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const observedAt = new Date('2026-03-12T10:00:00.000Z');

  beforeEach(() => {
    writeRawQueryMock.mockReset();
    writeRawQueryMock.mockResolvedValue([
      {
        trackedUserId: '22222222-2222-4222-8222-222222222222',
        trackedAccountId: '33333333-3333-4333-8333-333333333333',
        membershipObservedAt: observedAt,
      },
    ]);
  });

  test('uses one parameterized CTE for project, user, account and current membership', async () => {
    const result = await upsertTrackedIdentity({
      projectId,
      externalId: 'user-42',
      traits: { plan: 'pro', email: 'ada@example.test', name: 'Ada' },
      account: {
        id: 'acme',
        name: 'Acme',
        traits: { industry: 'software', billing_email: 'billing@example.test' },
      },
      observedAt,
      lifecycleStage: 'activated',
      activatedAt: observedAt,
    });

    expect(writeRawQueryMock).toHaveBeenCalledTimes(1);
    const [sql, params, queryName] = writeRawQueryMock.mock.calls[0];

    expect(sql).toContain('with live_project as');
    expect(sql).toContain('on conflict (project_id, external_id)');
    expect(sql).toContain('where {{accountExternalId::text}} is not null');
    expect(sql).toContain('on conflict (tracked_user_id)');
    expect(sql).toContain('excluded.observed_at >= account_membership.observed_at');
    expect(sql).toContain('least(tracked_user.first_seen_at, excluded.first_seen_at)');
    expect(sql).toContain('greatest(tracked_user.last_seen_at, excluded.last_seen_at)');
    expect(params).toMatchObject({
      projectId,
      userExternalId: 'user-42',
      displayName: 'Ada',
      userTraits: JSON.stringify({ plan: 'pro' }),
      userSensitiveTraits: JSON.stringify({ email: 'ada@example.test', name: 'Ada' }),
      accountExternalId: 'acme',
      accountTraits: JSON.stringify({ industry: 'software' }),
      accountSensitiveTraits: JSON.stringify({ billing_email: 'billing@example.test' }),
      observedAt,
    });
    expect(queryName).toBe('upsertTrackedIdentity');
    expect(result?.trackedAccountId).toBe('33333333-3333-4333-8333-333333333333');
  });

  test('keeps legacy ingestion compatible by skipping invalid projection IDs', async () => {
    await expect(
      upsertTrackedIdentity({
        projectId,
        externalId: 'x'.repeat(51),
        observedAt,
      }),
    ).resolves.toBeNull();
    expect(writeRawQueryMock).not.toHaveBeenCalled();
  });
});
