import { describe, expect, test } from 'vitest';
import { versionedIdentifyInputSchema } from './contracts';

describe('versioned identify contract', () => {
  test('accepts a user plus optional current account', () => {
    expect(
      versionedIdentifyInputSchema.safeParse({
        identityVersion: 1,
        id: 'user-42',
        data: { plan: 'pro' },
        account: { id: 'acme', name: 'Acme', traits: { plan: 'enterprise' } },
      }).success,
    ).toBe(true);
  });

  test('rejects empty, oversized and unknown-version external IDs', () => {
    expect(versionedIdentifyInputSchema.safeParse({ identityVersion: 1, id: '' }).success).toBe(
      false,
    );
    expect(
      versionedIdentifyInputSchema.safeParse({ identityVersion: 1, id: 'x'.repeat(51) }).success,
    ).toBe(false);
    expect(versionedIdentifyInputSchema.safeParse({ identityVersion: 2, id: 'user' }).success).toBe(
      false,
    );
  });
});
