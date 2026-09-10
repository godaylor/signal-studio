import type { PrismaClient } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

// Queue state/leases must be read from the writer, never a lagging replica.
export const exportDb = (
  '$primary' in prisma.client ? prisma.client.$primary() : prisma.client
) as PrismaClient;
