import { describe, expect, test } from 'vitest';
import { safeEvidenceReturnTo, sessionEvidenceQuerySchema } from './contracts';

const projectId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';

describe('session evidence contract', () => {
  test('accepts a bounded half-open evidence range and applies the page limit default', () => {
    expect(
      sessionEvidenceQuerySchema.parse({
        sessionId,
        startAt: '2026-03-01T00:00:00.000Z',
        endAt: '2026-03-10T00:00:00.000Z',
      }),
    ).toMatchObject({ sessionId, limit: 50 });
    expect(() =>
      sessionEvidenceQuerySchema.parse({
        sessionId,
        startAt: '2026-03-10T00:00:00.000Z',
        endAt: '2026-03-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  test('restores only a same-project Studio destination', () => {
    expect(safeEvidenceReturnTo(projectId, `/studio/${projectId}/explore?mode=funnel`)).toContain(
      '/explore?',
    );
    expect(safeEvidenceReturnTo(projectId, '//attacker.example')).toBe(
      `/studio/${projectId}/audiences`,
    );
    expect(safeEvidenceReturnTo(projectId, '/studio/other/explore')).toBe(
      `/studio/${projectId}/audiences`,
    );
  });
});
