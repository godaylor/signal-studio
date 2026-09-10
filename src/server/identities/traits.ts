import type { IdentityTraits } from './contracts';

export const IDENTITY_TRAIT_POLICY_VERSION = 'signal-studio.traits.v1';

const STANDARD_TRAIT_KEYS = new Set([
  'plan',
  'role',
  'industry',
  'company_size',
  'billing_tier',
  'employee_count',
  'lifecycle_stage',
]);

export const STANDARD_IDENTITY_TRAIT_KEYS = Object.freeze([...STANDARD_TRAIT_KEYS]);

export function isStandardIdentityTraitKey(value: string) {
  return STANDARD_TRAIT_KEYS.has(value);
}

const RESERVED_IDENTITY_KEYS = new Set(['id', 'identityVersion', 'account']);

export interface ClassifiedIdentityTraits {
  standard: IdentityTraits;
  sensitive: IdentityTraits;
}

export function classifyIdentityTraits(input: unknown): ClassifiedIdentityTraits {
  const standard: IdentityTraits = {};
  const sensitive: IdentityTraits = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { standard, sensitive };
  }

  for (const [key, value] of Object.entries(input)) {
    if (RESERVED_IDENTITY_KEYS.has(key) || value === undefined) {
      continue;
    }

    if (STANDARD_TRAIT_KEYS.has(key)) {
      standard[key] = value;
    } else {
      sensitive[key] = value;
    }
  }

  return { standard, sensitive };
}

export function getDisplayName(input: IdentityTraits | undefined) {
  const value = input?.display_name ?? input?.name;

  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 255) : undefined;
}
