import { afterEach, expect, test, vi } from 'vitest';
import { getDefaultSecurityHeaders, getManagementCorsHeaders } from './security-headers';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('management API is same-origin by default and never inherits ingestion wildcard CORS', () => {
  vi.stubEnv('MANAGEMENT_API_ALLOWED_ORIGIN', '');

  expect(getManagementCorsHeaders()).toEqual([]);
});

test('management CORS accepts one explicit origin and rejects wildcard', () => {
  vi.stubEnv('MANAGEMENT_API_ALLOWED_ORIGIN', 'https://studio.example.com');
  expect(getManagementCorsHeaders()).toContainEqual({
    key: 'Access-Control-Allow-Origin',
    value: 'https://studio.example.com',
  });

  vi.stubEnv('MANAGEMENT_API_ALLOWED_ORIGIN', '*');
  expect(getManagementCorsHeaders()).toEqual([]);
});

test('security header contract includes CSP and browser hardening headers', () => {
  expect(getDefaultSecurityHeaders(false)).toMatchInlineSnapshot(`
    [
      {
        "key": "X-DNS-Prefetch-Control",
        "value": "on",
      },
      {
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; img-src 'self' https: data: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-src 'self' http: https:; frame-ancestors 'self';",
      },
      {
        "key": "X-Content-Type-Options",
        "value": "nosniff",
      },
      {
        "key": "Referrer-Policy",
        "value": "strict-origin-when-cross-origin",
      },
      {
        "key": "Permissions-Policy",
        "value": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
    ]
  `);
});
