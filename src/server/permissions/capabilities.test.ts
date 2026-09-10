import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { client: { website: { findFirst: vi.fn() } } },
}));
import {
  deriveStudioCapabilities,
  legacyRoleToStudioRole,
  ROLE_CAPABILITIES,
  sanitizeCapabilityOverrides,
  STUDIO_CAPABILITIES,
  studioRoleToLegacyRole,
} from './capabilities';

describe('Signal Studio role capabilities', () => {
  it.each([
    ['owner', STUDIO_CAPABILITIES],
    [
      'admin',
      [
        'manageMembers',
        'manageSources',
        'editInsights',
        'editDashboards',
        'createSegments',
        'viewAggregate',
        'viewIdentity',
      ],
    ],
    [
      'analyst',
      ['editInsights', 'editDashboards', 'createSegments', 'viewAggregate', 'viewIdentity'],
    ],
    ['editor', ['editInsights', 'editDashboards', 'createSegments', 'viewAggregate']],
    ['viewer', ['viewAggregate']],
  ] as const)('matches the complete %s action matrix', (role, allowed) => {
    const actual = STUDIO_CAPABILITIES.filter(capability => ROLE_CAPABILITIES[role][capability]);
    expect(actual).toEqual(allowed);
  });

  it.each([
    ['team-owner', 'owner'],
    ['team-manager', 'admin'],
    ['team-member', 'editor'],
    ['team-view-only', 'viewer'],
    ['view-only', 'viewer'],
  ])('maps legacy role %s to %s', (legacyRole, studioRole) => {
    expect(legacyRoleToStudioRole(legacyRole)).toBe(studioRole);
  });

  it('keeps Analyst on the legacy member wire value', () => {
    expect(studioRoleToLegacyRole('analyst')).toBe('team-member');
  });

  it.each(['admin', 'analyst', 'editor', 'viewer'] as const)(
    'defaults high-risk capabilities to deny for a new %s membership',
    role => {
      const capabilities = deriveStudioCapabilities(role);
      expect(capabilities.viewSensitiveTraits).toBe(false);
      expect(capabilities.viewReplay).toBe(false);
      expect(capabilities.exportData).toBe(false);
      expect(capabilities.createPublicShare).toBe(false);
    },
  );

  it('applies only known boolean overrides', () => {
    expect(
      sanitizeCapabilityOverrides({
        viewReplay: true,
        exportData: false,
        createPublicShare: 'yes',
        inventedCapability: true,
      }),
    ).toEqual({ viewReplay: true, exportData: false });
  });

  it('allows an explicit migration override to preserve a legacy right', () => {
    expect(deriveStudioCapabilities('viewer', { exportData: true }).exportData).toBe(true);
  });
});
