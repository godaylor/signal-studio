import { z } from 'zod';

export const IDENTITY_CONTRACT_VERSION = 1 as const;
export const MAX_TRACKED_USER_EXTERNAL_ID_LENGTH = 50;
export const MAX_TRACKED_ACCOUNT_EXTERNAL_ID_LENGTH = 100;

export type IdentityTraits = Record<string, unknown>;

export interface TrackedAccountInput {
  id: string;
  name?: string;
  traits?: IdentityTraits;
}

export interface VersionedIdentifyInput {
  identityVersion: typeof IDENTITY_CONTRACT_VERSION;
  id: string;
  data?: IdentityTraits;
  account?: TrackedAccountInput;
}

export const trackedAccountInputSchema = z.object({
  id: z.string().trim().min(1).max(MAX_TRACKED_ACCOUNT_EXTERNAL_ID_LENGTH),
  name: z.string().trim().min(1).max(255).optional(),
  traits: z.record(z.string(), z.unknown()).optional(),
});

export const versionedIdentifyInputSchema = z.object({
  identityVersion: z.literal(IDENTITY_CONTRACT_VERSION),
  id: z.string().trim().min(1).max(MAX_TRACKED_USER_EXTERNAL_ID_LENGTH),
  data: z.record(z.string(), z.unknown()).optional(),
  account: trackedAccountInputSchema.optional(),
});

export interface UpsertTrackedIdentityInput {
  projectId: string;
  externalId: string;
  traits?: IdentityTraits;
  account?: TrackedAccountInput;
  observedAt: Date;
  lifecycleStage?: string;
  activatedAt?: Date | null;
}

export interface UpsertTrackedIdentityResult {
  trackedUserId: string;
  trackedAccountId: string | null;
  membershipObservedAt: Date | null;
}
