import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getClientAuthMode, getClientAuthToken, setClientAuthToken } from '@/lib/client';
import { GuestStartButton } from './GuestStartButton';

vi.mock('@/features/i18n/useStudioLocale', () => ({
  useStudioLocale: () => ({ t: (en: string) => en }),
}));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setClientAuthToken('preserved-account-session');
});
afterEach(() => vi.unstubAllGlobals());

describe('Guest entry failure and resource states', () => {
  test('keeps server markup disabled until the real click handler is hydrated', () => {
    const markup = renderToString(<GuestStartButton />);
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
    render(<GuestStartButton />);
    expect(screen.getByRole('button', { name: /Try without/ })).toBeEnabled();
  });
  test('keeps a retry available when the server cannot allocate another workspace', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: 'guest-resource-limit' } }),
    });
    vi.stubGlobal('fetch', fetch);
    render(<GuestStartButton />);
    fireEvent.click(screen.getByRole('button', { name: /Try without/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Guest spaces are busy');
    expect(screen.getByRole('button', { name: /Try without/ })).toBeEnabled();
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('authorization');
    expect(getClientAuthMode()).toBe('account');
    expect(getClientAuthToken()).toBe('preserved-account-session');
  });
  test('prevents duplicate entry requests and recovers after a connection failure', async () => {
    let fail: (error: Error) => void = () => {};
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    vi.stubGlobal('fetch', fetch);
    render(<GuestStartButton />);
    fireEvent.click(screen.getByRole('button', { name: /Try without/ }));
    const opening = screen.getByRole('button', { name: /Opening your workspace/ });
    expect(opening).toBeDisabled();
    fireEvent.click(opening);
    expect(fetch).toHaveBeenCalledTimes(1);
    fail(new Error('offline'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection lost'));
    expect(screen.getByRole('button', { name: /Try without/ })).toBeEnabled();
    expect(getClientAuthMode()).toBe('account');
    expect(getClientAuthToken()).toBe('preserved-account-session');
  });
});
