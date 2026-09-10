import debug from 'debug';
import { ROLE_PERMISSIONS, ROLES } from '@/lib/constants';
import { ensureArray } from '@/lib/utils';
import { getUser } from '@/queries/prisma/user';
import { AUTH_SETUP_TOKEN_TYPE } from '@/server/auth/constants';
import { parseAuthSessionToken, tokenMatchesUser } from '@/server/auth/tokens';
import { getTwoFactorPolicy } from '@/server/auth/two-factor-policy';

const log = debug('umami:auth');

export function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization');

  return auth?.split(' ')[1];
}

export async function checkAuth(request: Request) {
  const token = getBearerToken(request);
  const payload = parseAuthSessionToken(token);
  // Shares never authenticate management/legacy analytics endpoints. Studio
  // shares have a dedicated resolver which validates the live share record.
  const shareToken = null;

  let user = null;
  let assuranceRequired = false;
  const { userId } = payload || {};

  if (userId) {
    user = await getUser(userId, { includePassword: true, includeSessionVersion: true });

    if (!user || !tokenMatchesUser(payload, user)) {
      user = null;
    } else {
      const policy = await getTwoFactorPolicy(userId, user.twoFactorRequired);
      assuranceRequired =
        payload.type === AUTH_SETUP_TOKEN_TYPE ||
        (policy.required && (!policy.enabled || payload.aal < 2));
    }
  }

  log({
    hasToken: !!token,
    hasPayload: !!payload,
    hasShareToken: !!shareToken,
    userId: user?.id,
    assuranceRequired,
  });

  if (!user?.id) {
    log('User not authorized');
    return null;
  }

  if (user) {
    delete user.password;
    delete user.sessionVersion;
    user.isAdmin = user.role === ROLES.admin;
  }

  return {
    token,
    sessionId: payload?.sid,
    assuranceLevel: payload?.aal,
    assuranceRequired,
    shareToken,
    user,
  };
}

export async function hasPermission(role: string, permission: string | string[]) {
  return ensureArray(permission).some(e => ROLE_PERMISSIONS[role]?.includes(e));
}
