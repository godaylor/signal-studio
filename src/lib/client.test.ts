import { beforeEach, describe, expect, test } from 'vitest';
import {
  activateClientGuestSession,
  getClientAuthHeaders,
  getClientAuthMode,
  getClientAuthToken,
  removeClientAuthToken,
  restoreClientAccountSession,
  setClientAuthToken,
} from './client';
import { AUTH_TOKEN } from './constants';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('explicit per-tab authentication selection', () => {
  test.each(['valid-account-session', 'expired-or-invalid-account-session'])(
    'guest selection suppresses %s without deleting it',
    token => {
      setClientAuthToken(token);
      expect(getClientAuthHeaders()).toEqual({ authorization: `Bearer ${token}` });
      activateClientGuestSession();
      expect(getClientAuthMode()).toBe('guest');
      expect(getClientAuthToken()).toBeNull();
      expect(getClientAuthHeaders()).toEqual({});
      expect(JSON.parse(localStorage.getItem(AUTH_TOKEN) ?? 'null')).toBe(token);
      expect(JSON.parse(sessionStorage.getItem('umami.auth.mode') ?? 'null')).toBe('guest');
      restoreClientAccountSession();
      expect(getClientAuthHeaders()).toEqual({ authorization: `Bearer ${token}` });
    },
  );

  test('normal login replaces the account credential and explicitly leaves guest mode', () => {
    setClientAuthToken('old-account');
    activateClientGuestSession();
    setClientAuthToken('new-account');
    expect(getClientAuthMode()).toBe('account');
    expect(getClientAuthHeaders()).toEqual({ authorization: 'Bearer new-account' });
  });

  test('guest logout preserves the account while account logout removes its credential', () => {
    setClientAuthToken('preserved-account');
    activateClientGuestSession();
    removeClientAuthToken();
    expect(getClientAuthMode()).toBe('account');
    expect(getClientAuthToken()).toBe('preserved-account');
    removeClientAuthToken();
    expect(getClientAuthToken()).toBeFalsy();
  });
});
