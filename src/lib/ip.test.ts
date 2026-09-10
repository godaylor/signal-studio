import { afterEach, describe, expect, test, vi } from 'vitest';
import { getIpAddress, stripPort } from './ip';

function headers(init: Record<string, string>) {
  return new Headers(init);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getIpAddress', () => {
  test('ignores spoofable proxy headers by default', () => {
    expect(
      getIpAddress(
        headers({
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
          'x-real-ip': '192.0.2.9',
          'cf-connecting-ip': '203.0.113.5',
        }),
      ),
    ).toBeUndefined();
  });

  test('honors only the explicitly configured trusted proxy header', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-custom-ip');

    expect(
      getIpAddress(
        headers({
          'x-custom-ip': '10.0.0.1',
          'x-forwarded-for': '1.2.3.4',
        }),
      ),
    ).toBe('10.0.0.1');
  });

  test('does not fall back when the configured trusted header is absent', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-custom-ip');

    expect(getIpAddress(headers({ 'x-forwarded-for': '1.2.3.4' }))).toBeUndefined();
  });

  test('extracts the first address only when x-forwarded-for is explicitly trusted', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-forwarded-for');

    expect(getIpAddress(headers({ 'x-forwarded-for': ' 1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  test('parses forwarded only when explicitly trusted', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'forwarded');

    expect(getIpAddress(headers({ forwarded: 'for=192.0.2.60;proto=http;by=203.0.113.43' }))).toBe(
      '192.0.2.60',
    );
  });

  test('normalizes configured IPv6 and rejects malformed values', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-real-ip');

    expect(getIpAddress(headers({ 'x-real-ip': '2001:0db8:0000:0000:0000:0000:0000:0001' }))).toBe(
      '2001:db8::1',
    );
    expect(getIpAddress(headers({ 'x-real-ip': 'not-an-ip' }))).toBeUndefined();
  });

  test('resolves IPv4 with a port through the configured header', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-real-ip');

    expect(getIpAddress(headers({ 'x-real-ip': '192.0.2.9:8443' }))).toBe('192.0.2.9');
  });

  test('resolves bracketed IPv6 with a port through the configured header', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-real-ip');

    expect(getIpAddress(headers({ 'x-real-ip': '[2001:db8::1]:8443' }))).toBe('2001:db8::1');
  });
});

describe('stripPort', () => {
  test('returns nullish input unchanged', () => {
    expect(stripPort(undefined)).toBeUndefined();
    expect(stripPort(null)).toBeNull();
    expect(stripPort('')).toBe('');
  });

  test('removes the port from an IPv4 address', () => {
    expect(stripPort('1.2.3.4:8080')).toBe('1.2.3.4');
  });

  test('leaves a plain IPv4 address unchanged', () => {
    expect(stripPort('1.2.3.4')).toBe('1.2.3.4');
  });

  test('removes brackets and port from a bracketed IPv6 address', () => {
    expect(stripPort('[::1]:8080')).toBe('::1');
  });

  test('leaves an unbracketed IPv6 address unchanged', () => {
    expect(stripPort('::1')).toBe('::1');
  });
});
