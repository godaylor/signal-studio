import { createAuthKey, hash, secret } from '@/lib/crypto';
import { createSecureToken, parseSecureToken } from '@/lib/jwt';
import {
  AUTH_SETUP_TOKEN_TYPE,
  AUTH_TOKEN_AUDIENCE,
  AUTH_TOKEN_CLOCK_SKEW_SECONDS,
  AUTH_TOKEN_TYPE,
  getAuthTokenTtlSeconds,
  getPartialAuthTokenTtlSeconds,
  PARTIAL_AUTH_TOKEN_AUDIENCE,
  PARTIAL_AUTH_TOKEN_TYPE,
} from './constants';

export type AuthAssuranceLevel = 1 | 2;

export interface AuthTokenUser {
  id: string;
  role: string;
  password: string;
  sessionVersion: number;
}

export interface AuthTokenPayload {
  userId: string;
  role: string;
  pwd: string;
  sv: number;
  aal: AuthAssuranceLevel;
  sid: string;
  type: typeof AUTH_TOKEN_TYPE | typeof AUTH_SETUP_TOKEN_TYPE;
  aud: string | string[];
  iat: number;
  exp: number;
  sub: string;
}

export interface PartialAuthTokenPayload {
  userId: string;
  pwd: string;
  sv: number;
  type: typeof PARTIAL_AUTH_TOKEN_TYPE;
  aud: string | string[];
  iat: number;
  exp: number;
  sub: string;
}

export const AUTH_TOKEN_ALGORITHM = 'HS512' as const;

function passwordFingerprint(password: string) {
  return hash(password);
}

export function issueAuthToken(
  user: AuthTokenUser,
  assurance: AuthAssuranceLevel,
  options: { setupOnly?: boolean; expiresIn?: number } = {},
) {
  const type = options.setupOnly ? AUTH_SETUP_TOKEN_TYPE : AUTH_TOKEN_TYPE;

  return createSecureToken(
    {
      userId: user.id,
      role: user.role,
      pwd: passwordFingerprint(user.password),
      sv: user.sessionVersion,
      aal: assurance,
      sid: createAuthKey(),
      type,
    },
    secret(),
    {
      audience: AUTH_TOKEN_AUDIENCE,
      algorithm: AUTH_TOKEN_ALGORITHM,
      expiresIn: options.expiresIn ?? getAuthTokenTtlSeconds(),
      subject: user.id,
    },
  );
}

export function issuePartialAuthToken(user: AuthTokenUser) {
  return createSecureToken(
    {
      userId: user.id,
      pwd: passwordFingerprint(user.password),
      sv: user.sessionVersion,
      type: PARTIAL_AUTH_TOKEN_TYPE,
    },
    secret(),
    {
      audience: PARTIAL_AUTH_TOKEN_AUDIENCE,
      algorithm: AUTH_TOKEN_ALGORITHM,
      expiresIn: getPartialAuthTokenTtlSeconds(),
      subject: user.id,
    },
  );
}

export function parseAuthSessionToken(token?: string | null) {
  const payload = parseSecureToken(token as string, secret(), {
    audience: AUTH_TOKEN_AUDIENCE,
    algorithms: [AUTH_TOKEN_ALGORITHM],
  }) as AuthTokenPayload | null;

  if (
    !payload ||
    ![AUTH_TOKEN_TYPE, AUTH_SETUP_TOKEN_TYPE].includes(payload.type) ||
    !payload.userId ||
    !payload.sid ||
    !payload.pwd ||
    !Number.isInteger(payload.sv) ||
    payload.sv < 0 ||
    payload.sub !== payload.userId ||
    payload.aud !== AUTH_TOKEN_AUDIENCE ||
    !validLifetime(payload.iat, payload.exp, getAuthTokenTtlSeconds()) ||
    ![1, 2].includes(payload.aal)
  ) {
    return null;
  }

  return payload;
}

export function parsePartialAuthToken(token?: string | null) {
  const payload = parseSecureToken(token as string, secret(), {
    audience: PARTIAL_AUTH_TOKEN_AUDIENCE,
    algorithms: [AUTH_TOKEN_ALGORITHM],
  }) as PartialAuthTokenPayload | null;

  if (
    !payload ||
    payload.type !== PARTIAL_AUTH_TOKEN_TYPE ||
    !payload.userId ||
    !payload.pwd ||
    !Number.isInteger(payload.sv) ||
    payload.sv < 0 ||
    payload.sub !== payload.userId ||
    payload.aud !== PARTIAL_AUTH_TOKEN_AUDIENCE ||
    !validLifetime(payload.iat, payload.exp, getPartialAuthTokenTtlSeconds())
  ) {
    return null;
  }

  return payload;
}

function validLifetime(iat: unknown, exp: unknown, maximumTtlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);

  return (
    Number.isInteger(iat) &&
    Number.isInteger(exp) &&
    (exp as number) > (iat as number) &&
    (exp as number) - (iat as number) <= maximumTtlSeconds &&
    (iat as number) <= now + AUTH_TOKEN_CLOCK_SKEW_SECONDS
  );
}

export function tokenMatchesUser(
  payload: Pick<AuthTokenPayload | PartialAuthTokenPayload, 'pwd' | 'sv'>,
  user: Pick<AuthTokenUser, 'password' | 'sessionVersion'>,
) {
  return payload.pwd === passwordFingerprint(user.password) && payload.sv === user.sessionVersion;
}
