import { beforeEach, expect, test, vi } from 'vitest';
import { getDevice, getLocation, hasBlockedIp } from './detect';
import { getIpAddress } from './ip';
import maxmind from 'maxmind';

vi.mock('maxmind', () => ({ default: { open: vi.fn() } }));

const IP = '127.0.0.1';

test.each([
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', '390x844', 'mobile'],
  ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', '1024x768', 'tablet'],
  ['Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36', '412x915', 'mobile'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', '1920x1080', 'laptop'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', '2560x1440', 'desktop'],
  ['', '', 'desktop'],
])('device compatibility: %s', (agent, screen, expected) => {
  expect(getDevice(agent, screen)).toBe(expected);
});

const isLocalhost = vi.mocked(await import('is-localhost-ip'));

vi.mock('is-localhost-ip', () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();

  delete process.env.CLIENT_IP_HEADER;
  delete process.env.IGNORE_IP;
  delete process.env.SKIP_LOCATION_HEADERS;
  delete process.env.GEOLITE_DB_PATH;
  delete globalThis.maxmind;
});

test('optional missing GeoLite data does not reject public-IP ingestion', async () => {
  vi.mocked(maxmind.open).mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  await expect(getLocation('8.8.8.8', new Headers(), true)).resolves.toBeNull();
});

test('an explicitly configured missing GeoLite database remains an operator error', async () => {
  process.env.GEOLITE_DB_PATH = '/operator/configured.mmdb';
  vi.mocked(maxmind.open).mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  await expect(getLocation('8.8.8.8', new Headers(), true)).rejects.toThrow('missing');
});

test('getIpAddress: Custom header', () => {
  process.env.CLIENT_IP_HEADER = 'x-custom-ip-header';

  expect(getIpAddress(new Headers({ 'x-custom-ip-header': IP }))).toEqual(IP);
});

test('getIpAddress: Custom header set to x-forwarded-for uses leftmost IP in chain', () => {
  process.env.CLIENT_IP_HEADER = 'x-forwarded-for';

  expect(getIpAddress(new Headers({ 'x-forwarded-for': `${IP}, 10.0.0.1, 10.0.0.2` }))).toEqual(IP);
});

test('getIpAddress: ignores CloudFlare header without explicit trust configuration', () => {
  expect(getIpAddress(new Headers({ 'cf-connecting-ip': IP }))).toBeUndefined();
});

test('getIpAddress: ignores standard proxy header without explicit trust configuration', () => {
  expect(getIpAddress(new Headers({ 'x-forwarded-for': IP }))).toBeUndefined();
});

test('getIpAddress: No header', () => {
  expect(getIpAddress(new Headers())).toEqual(undefined);
});

test('getLocation: returns null for malformed ip', async () => {
  await expect(
    getLocation(
      'not-an-ip',
      new Headers({
        'cf-ipcountry': 'US',
        'cf-region-code': 'CA',
        'cf-ipcity': 'Los Angeles',
      }),
      false,
    ),
  ).resolves.toEqual(null);
});

test('getLocation: treats localhost check errors as non-local', async () => {
  isLocalhost.default.mockRejectedValue(new Error('DNS Lookup failed.'));

  await expect(
    getLocation(
      '8.8.8.8',
      new Headers({
        'cf-ipcountry': 'US',
        'cf-region-code': 'CA',
        'cf-ipcity': 'Los Angeles',
      }),
      false,
    ),
  ).resolves.toEqual({
    country: 'US',
    region: 'US-CA',
    city: 'Los Angeles',
  });
});

test('hasBlockedIp: returns false for malformed client ip with cidr block', () => {
  process.env.IGNORE_IP = '10.0.0.0/8';

  expect(hasBlockedIp('not-an-ip')).toBe(false);
});
