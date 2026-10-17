import { getItem, removeItem, setItem } from '@/lib/storage';
import { AUTH_TOKEN } from './constants';

const AUTH_MODE = 'umami.auth.mode';

export function getClientAuthMode(): 'account' | 'guest' {
  return getItem(AUTH_MODE, true) === 'guest' ? 'guest' : 'account';
}

/** Guest selection belongs to this tab. The real account credential stays intact. */
export function activateClientGuestSession() {
  setItem(AUTH_MODE, 'guest', true);
}

export function restoreClientAccountSession() {
  removeItem(AUTH_MODE, true);
}

export function getClientAuthToken() {
  return getClientAuthMode() === 'guest' ? null : getItem(AUTH_TOKEN);
}

/** Cookie sessions authenticate guests; existing accounts keep their bearer token. */
export function getClientAuthHeaders(): Record<string, string> {
  const token = getClientAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function setClientAuthToken(token: string) {
  setItem(AUTH_TOKEN, token);
  restoreClientAccountSession();
}

export function removeClientAuthToken() {
  if (getClientAuthMode() === 'guest') {
    restoreClientAccountSession();
    return;
  }
  removeItem(AUTH_TOKEN);
}
