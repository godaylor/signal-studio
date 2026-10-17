import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { activateClientGuestSession, setClientAuthToken } from '@/lib/client';
import { useApi } from './useApi';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('API callbacks after authentication context changes', () => {
  test('uses current auth on callbacks created before guest entry and normal login', async () => {
    const fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal('fetch', fetch);
    setClientAuthToken('preserved-account');
    const { result } = renderHook(() => useApi());
    const post = result.current.post;
    await post('/auth/verify');
    expect(fetch.mock.calls.at(-1)?.[1].headers.authorization).toBe('Bearer preserved-account');
    activateClientGuestSession();
    await post('/auth/verify');
    expect(fetch.mock.calls.at(-1)?.[1].headers).not.toHaveProperty('authorization');
    setClientAuthToken('new-account');
    await post('/auth/verify');
    expect(fetch.mock.calls.at(-1)?.[1].headers.authorization).toBe('Bearer new-account');
  });
});
