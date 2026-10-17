import { getItem, removeItem, setItem } from '@/lib/storage';
import { AUTH_TOKEN } from './constants';

export function getClientAuthToken() {
  return getItem(AUTH_TOKEN);
}

/** Cookie sessions authenticate guests; existing accounts keep their bearer token. */
export function getClientAuthHeaders(): Record<string, string> {
  const token = getClientAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function setClientAuthToken(token: string) {
  setItem(AUTH_TOKEN, token);
}

export function removeClientAuthToken() {
  removeItem(AUTH_TOKEN);
}
