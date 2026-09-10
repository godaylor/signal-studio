import { expect, test, vi } from 'vitest';

const create = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  default: { client: { securityAuditEvent: { create } } },
}));

import { recordSecurityAuditEvent } from './audit';

test('audit storage failure is best-effort and never exposes or changes the auth decision', async () => {
  create.mockRejectedValueOnce(new Error('database unavailable'));

  await expect(
    recordSecurityAuditEvent({
      actorUserId: '11111111-1111-4111-8111-111111111111',
      eventType: 'auth.login',
      outcome: 'failure',
      metadata: { reason: 'invalid_credentials' },
    }),
  ).resolves.toBeUndefined();
});
