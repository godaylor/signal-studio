import { describe, expect, test } from 'vitest';
import { classifyIdentityTraits, getDisplayName } from './traits';

describe('identity trait classification', () => {
  test('keeps only the versioned allowlist in standard traits', () => {
    expect(
      classifyIdentityTraits({
        plan: 'enterprise',
        role: 'admin',
        industry: 'software',
        email: 'ada@example.test',
        phone: '+1-555-0100',
        custom_secret: 'private',
      }),
    ).toEqual({
      standard: { plan: 'enterprise', role: 'admin', industry: 'software' },
      sensitive: {
        email: 'ada@example.test',
        phone: '+1-555-0100',
        custom_secret: 'private',
      },
    });
  });

  test('unknown keys are sensitive by default and reserved identity keys are not traits', () => {
    expect(
      classifyIdentityTraits({
        id: 'user-42',
        identityVersion: 1,
        account: { id: 'acme' },
        favorite_color: 'blue',
      }),
    ).toEqual({ standard: {}, sensitive: { favorite_color: 'blue' } });
  });

  test('derives a bounded display name without moving it into standard traits', () => {
    expect(getDisplayName({ name: '  Ada Lovelace  ' })).toBe('Ada Lovelace');
    expect(getDisplayName({ name: '' })).toBeUndefined();
  });
});
