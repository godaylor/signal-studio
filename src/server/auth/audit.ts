import { randomUUID } from 'node:crypto';
import debug from 'debug';
import prisma from '@/lib/prisma';

const log = debug('signal-studio:security-audit');

export type SecurityAuditOutcome = 'success' | 'failure' | 'blocked';

export async function recordSecurityAuditEvent({
  actorUserId,
  eventType,
  outcome,
  metadata,
}: {
  actorUserId?: string | null;
  eventType: string;
  outcome: SecurityAuditOutcome;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  try {
    await prisma.client.securityAuditEvent.create({
      data: {
        id: randomUUID(),
        actorUserId: actorUserId ?? null,
        eventType,
        outcome,
        metadata,
      },
    });
  } catch (error) {
    // Authentication must fail or succeed based on its own state, not on an
    // optional audit write. The failure is still visible to server operators.
    log('security audit write failed', error);
  }
}
