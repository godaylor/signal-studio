import { beforeEach, expect, test, vi } from 'vitest';
import { hash, secret } from '@/lib/crypto';
import { createSecureToken } from '@/lib/jwt';
import {
  AUTH_SETUP_TOKEN_TYPE,
  AUTH_TOKEN_AUDIENCE,
  AUTH_TOKEN_TYPE,
  getAuthTokenTtlSeconds,
  PARTIAL_AUTH_TOKEN_AUDIENCE,
} from './constants';
import {
  AUTH_TOKEN_ALGORITHM,
  issueAuthToken,
  issuePartialAuthToken,
  parseAuthSessionToken,
  parsePartialAuthToken,
  tokenMatchesUser,
} from './tokens';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'admin',
  password: 'bcrypt-hash',
  sessionVersion: 7,
};

function fullPayload(overrides: Record<string, unknown> = {}) {
  return {
    userId: user.id,
    role: user.role,
    pwd: hash(user.password),
    sv: user.sessionVersion,
    aal: 2,
    sid: 'session',
    type: AUTH_TOKEN_TYPE,
    ...overrides,
  };
}

function secureFullToken(
  overrides: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
) {
  return createSecureToken(fullPayload(overrides), secret(), {
    audience: AUTH_TOKEN_AUDIENCE,
    algorithm: AUTH_TOKEN_ALGORITHM,
    expiresIn: 60,
    subject: user.id,
    ...options,
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('APP_SECRET', 'token-test-secret-at-least-32-characters');
});

test('full tokens carry type, audience, TTL, password/session version and assurance', () => {
  const payload = parseAuthSessionToken(issueAuthToken(user, 2));

  expect(payload).toMatchObject({
    userId: user.id,
    type: AUTH_TOKEN_TYPE,
    aud: AUTH_TOKEN_AUDIENCE,
    pwd: hash(user.password),
    sv: 7,
    aal: 2,
  });
  expect(payload).not.toBeNull();
  expect(payload?.exp).toBeGreaterThan(payload?.iat ?? Number.POSITIVE_INFINITY);
});

test('partial tokens use a distinct audience and expire independently', () => {
  const payload = parsePartialAuthToken(issuePartialAuthToken(user));

  expect(payload).toMatchObject({
    userId: user.id,
    aud: PARTIAL_AUTH_TOKEN_AUDIENCE,
    sv: 7,
  });
});

test('rejects expired and wrong-audience full tokens', () => {
  const expired = createSecureToken(
    {
      userId: user.id,
      role: user.role,
      pwd: hash(user.password),
      sv: 7,
      aal: 2,
      sid: 'session',
      type: AUTH_TOKEN_TYPE,
    },
    secret(),
    { audience: AUTH_TOKEN_AUDIENCE, expiresIn: -1 },
  );
  const wrongAudience = createSecureToken(
    {
      userId: user.id,
      role: user.role,
      pwd: hash(user.password),
      sv: 7,
      aal: 2,
      sid: 'session',
      type: AUTH_TOKEN_TYPE,
    },
    secret(),
    { audience: 'wrong', expiresIn: 60 },
  );

  expect(parseAuthSessionToken(expired)).toBeNull();
  expect(parseAuthSessionToken(wrongAudience)).toBeNull();
});

test('rejects tokens missing integer iat/exp or with an excessive TTL', () => {
  const noExpiry = createSecureToken(fullPayload(), secret(), {
    audience: AUTH_TOKEN_AUDIENCE,
    algorithm: AUTH_TOKEN_ALGORITHM,
    subject: user.id,
  });
  const now = Math.floor(Date.now() / 1000);
  const noIssuedAt = createSecureToken(fullPayload({ exp: now + 60 }), secret(), {
    audience: AUTH_TOKEN_AUDIENCE,
    algorithm: AUTH_TOKEN_ALGORITHM,
    subject: user.id,
    noTimestamp: true,
  });
  const excessiveTtl = secureFullToken({}, { expiresIn: getAuthTokenTtlSeconds() + 1 });

  expect(parseAuthSessionToken(noExpiry)).toBeNull();
  expect(parseAuthSessionToken(noIssuedAt)).toBeNull();
  expect(parseAuthSessionToken(excessiveTtl)).toBeNull();
});

test('rejects wrong algorithm, audience, type and subject', () => {
  const wrongAlgorithm = createSecureToken(fullPayload(), secret(), {
    audience: AUTH_TOKEN_AUDIENCE,
    algorithm: 'HS256',
    expiresIn: 60,
    subject: user.id,
  });
  const wrongAudience = secureFullToken({}, { audience: 'wrong-audience' });
  const wrongType = secureFullToken({ type: 'collection-cache' });
  const wrongSubject = secureFullToken({}, { subject: 'different-user' });

  expect(parseAuthSessionToken(wrongAlgorithm)).toBeNull();
  expect(parseAuthSessionToken(wrongAudience)).toBeNull();
  expect(parseAuthSessionToken(wrongType)).toBeNull();
  expect(parseAuthSessionToken(wrongSubject)).toBeNull();
});

test('rejects malformed session versions and setup-token contract confusion', () => {
  expect(parseAuthSessionToken(secureFullToken({ sv: '7' }))).toBeNull();
  expect(parseAuthSessionToken(secureFullToken({ sv: -1 }))).toBeNull();
  expect(parseAuthSessionToken(secureFullToken({ sv: undefined }))).toBeNull();

  const setup = secureFullToken({ type: AUTH_SETUP_TOKEN_TYPE });
  expect(parsePartialAuthToken(setup)).toBeNull();
});

test('accepts normal positive clock skew and rejects an unreasonable future iat', () => {
  const now = Math.floor(Date.now() / 1000);
  const withinSkew = secureFullToken({ iat: now + 20 });
  const beyondSkew = secureFullToken({ iat: now + 60 });

  expect(parseAuthSessionToken(withinSkew)).not.toBeNull();
  expect(parseAuthSessionToken(beyondSkew)).toBeNull();
});

test.each([
  ['password login full', () => issueAuthToken(user, 1), parseAuthSessionToken],
  [
    'required-2FA setup-only',
    () => issueAuthToken(user, 1, { setupOnly: true }),
    parseAuthSessionToken,
  ],
  ['SSO full', () => issueAuthToken(user, 2), parseAuthSessionToken],
  ['2FA setup confirmation full', () => issueAuthToken(user, 2), parseAuthSessionToken],
  ['2FA verification full', () => issueAuthToken(user, 2), parseAuthSessionToken],
  ['password login partial', () => issuePartialAuthToken(user), parsePartialAuthToken],
])('%s issuer is compatible with its strict parser', (_name, issue, parse) => {
  expect(parse(issue())).not.toBeNull();
});

test('password or session version changes revoke a token deterministically', () => {
  const payload = parseAuthSessionToken(issueAuthToken(user, 1));

  expect(payload).not.toBeNull();
  if (!payload) {
    throw new Error('Expected a valid auth payload');
  }
  expect(tokenMatchesUser(payload, user)).toBe(true);
  expect(tokenMatchesUser(payload, { ...user, password: 'new-hash' })).toBe(false);
  expect(tokenMatchesUser(payload, { ...user, sessionVersion: 8 })).toBe(false);
});
