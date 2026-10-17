import type { PrismaClient } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

// Expiry, revocation and quotas always consult the writer, including replica deployments.
export function getGuestDatabase() {
  return ('$primary' in prisma.client ? prisma.client.$primary() : prisma.client) as PrismaClient;
}
