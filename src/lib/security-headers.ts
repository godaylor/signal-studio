import { getContentSecurityPolicy } from './csp';

export function getManagementCorsHeaders() {
  const allowedOrigin = process.env.MANAGEMENT_API_ALLOWED_ORIGIN?.trim();

  if (!allowedOrigin || allowedOrigin === '*') {
    return [];
  }

  try {
    if (new URL(allowedOrigin).origin !== allowedOrigin) {
      return [];
    }
  } catch {
    return [];
  }

  return [
    { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
    {
      key: 'Access-Control-Allow-Headers',
      value: 'Authorization, Content-Type, x-umami-share-token, x-umami-share-context',
    },
    { key: 'Access-Control-Allow-Methods', value: 'GET, DELETE, POST, PUT, PATCH, OPTIONS' },
    { key: 'Access-Control-Max-Age', value: process.env.CORS_MAX_AGE || '86400' },
    { key: 'Vary', value: 'Origin' },
  ];
}

export function getDefaultSecurityHeaders(forceSSL = false) {
  const headers = [
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'Content-Security-Policy', value: getContentSecurityPolicy() },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    },
  ];

  if (forceSSL) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
