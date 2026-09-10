import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { client: { website: { findFirst: vi.fn() } } },
}));
import { memberCreateSchema } from '@/server/members/contracts';
import { SAFE_SHARE_SCOPE, safeShareScopeSchema, shareCreateSchema } from './contracts';

const future = '2026-10-01T12:00:00.000+00:00';

describe('M14 role and safe-share contracts', () => {
  it('accepts Analyst as a product role without adding a legacy role value', () => {
    expect(
      memberCreateSchema.parse({ username: 'analyst@example.test', studioRole: 'analyst' }),
    ).toEqual({
      username: 'analyst@example.test',
      studioRole: 'analyst',
      capabilityOverrides: {},
    });
    expect(memberCreateSchema.safeParse({ username: 'owner', studioRole: 'owner' }).success).toBe(
      false,
    );
  });

  it.each(['audience', 'experience', 'replay'])('rejects unsupported %s public resources', type => {
    expect(
      shareCreateSchema.safeParse({
        resourceType: type,
        resourceId: '11111111-1111-4111-8111-111111111111',
        name: 'Unsafe share',
        visibility: 'public',
        expiresAt: future,
      }).success,
    ).toBe(false);
  });

  it.each(['insight', 'dashboard'] as const)('accepts an aggregate-only %s share', resourceType => {
    const result = shareCreateSchema.parse({
      resourceType,
      resourceId: '11111111-1111-4111-8111-111111111111',
      name: 'Safe share',
      visibility: 'public',
      expiresAt: future,
    });
    expect(result.scope).toEqual(SAFE_SHARE_SCOPE);
  });

  it.each(['allowDrilldown', 'allowIdentity', 'allowSensitiveTraits', 'allowReplay'] as const)(
    'cannot widen %s in the share scope',
    capability => {
      expect(safeShareScopeSchema.safeParse({ ...SAFE_SHARE_SCOPE, [capability]: true }).success).toBe(
        false,
      );
    },
  );
});
