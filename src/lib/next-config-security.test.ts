import { expect, test } from 'vitest';
import nextConfig from '../../next.config';

test('actual Next header rules separate management and public collection CORS', async () => {
  const rules = await (nextConfig as any).headers();
  const management = rules.find((rule: any) => rule.source === '/api/:path*');
  const defaults = rules.find((rule: any) => rule.source === '/:path*');
  const send = rules.find((rule: any) => rule.source === '/api/send');

  expect(defaults.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'Content-Security-Policy' }),
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ]),
  );
  expect(management.headers).toContainEqual({ key: 'Cache-Control', value: 'no-cache' });
  expect(management.headers).not.toContainEqual({
    key: 'Access-Control-Allow-Origin',
    value: '*',
  });
  expect(send.headers).toContainEqual({ key: 'Access-Control-Allow-Origin', value: '*' });
});
