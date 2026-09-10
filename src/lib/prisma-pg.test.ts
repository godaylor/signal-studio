import { describe, expect, test } from 'vitest';
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
});
