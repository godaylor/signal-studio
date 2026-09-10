import { forbidden } from '@/lib/response';

export const LEGACY_SHARE_CREATION_ERROR = Object.freeze({
  code: 'legacy-share-creation-disabled',
  message: 'Legacy public shares are read-only. Use a Signal Studio Insight or Dashboard share.',
});

export function legacyShareCreationDisabled() {
  return forbidden(LEGACY_SHARE_CREATION_ERROR);
}
