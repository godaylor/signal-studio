import { describe, expect, test, vi } from 'vitest';
import { getPrismaPgConfig } from './prisma-pg';

describe('getPrismaPgConfig', () => {
  test('maps the explicit no-verify compatibility mode to node-postgres SSL options', () => {
    expect(
      getPrismaPgConfig('postgresql://user:pass@db.example.test/studio?sslmode=no-verify', { max: 2 }),
    ).toMatchObject({
      connectionString: 'postgresql://user:pass@db.example.test/studio?sslmode=no-verify',
      max: 2,
      ssl: { rejectUnauthorized: false },
    });
  });

  test('keeps strict driver defaults when no compatibility mode is requested', () => {
    expect(getPrismaPgConfig('postgresql://user:pass@db.example.test/studio')).not.toHaveProperty('ssl');
  });
  test('serverless isolates small pools and keeps TLS verification intact', () => {
    vi.stubEnv('SIGNAL_STUDIO_SERVERLESS', '1');
    try {
      const config = getPrismaPgConfig('postgresql://user:pass@db.example.test/studio?sslmode=verify-full');
      expect(config).toMatchObject({ max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
      expect(config).not.toHaveProperty('ssl');
    } finally { vi.unstubAllEnvs(); }
  });
});
