export const AUTH_TOKEN_TYPE = 'auth';
export const AUTH_SETUP_TOKEN_TYPE = 'auth-setup';
export const PARTIAL_AUTH_TOKEN_TYPE = 'partial-auth';

export const AUTH_TOKEN_AUDIENCE = 'signal-studio-management';
export const PARTIAL_AUTH_TOKEN_AUDIENCE = 'signal-studio-two-factor';
export const COLLECTION_TOKEN_AUDIENCE = 'signal-studio-collection';

export const DEFAULT_AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60;
export const DEFAULT_PARTIAL_AUTH_TOKEN_TTL_SECONDS = 5 * 60;
export const DEFAULT_COLLECTION_TOKEN_TTL_SECONDS = 31 * 24 * 60 * 60;
export const MAX_AUTH_TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const MAX_PARTIAL_AUTH_TOKEN_TTL_SECONDS = 15 * 60;
export const MAX_COLLECTION_TOKEN_TTL_SECONDS = 31 * 24 * 60 * 60;
export const AUTH_TOKEN_CLOCK_SKEW_SECONDS = 30;

function getPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function getAuthTokenTtlSeconds() {
  return Math.min(
    getPositiveInteger('AUTH_TOKEN_TTL_SECONDS', DEFAULT_AUTH_TOKEN_TTL_SECONDS),
    MAX_AUTH_TOKEN_TTL_SECONDS,
  );
}

export function getPartialAuthTokenTtlSeconds() {
  return Math.min(
    getPositiveInteger('PARTIAL_AUTH_TOKEN_TTL_SECONDS', DEFAULT_PARTIAL_AUTH_TOKEN_TTL_SECONDS),
    MAX_PARTIAL_AUTH_TOKEN_TTL_SECONDS,
  );
}

export function getCollectionTokenTtlSeconds() {
  return Math.min(
    getPositiveInteger('COLLECTION_TOKEN_TTL_SECONDS', DEFAULT_COLLECTION_TOKEN_TTL_SECONDS),
    MAX_COLLECTION_TOKEN_TTL_SECONDS,
  );
}
