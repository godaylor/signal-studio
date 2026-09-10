import { randomUUID } from 'node:crypto';
import { DATA_TYPE, EVENT_TYPE } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { GOLDEN_DATASET } from '@/test/analytics/golden';

type SeededGoldenDataset = {
  websiteId: string;
  cleanup: () => Promise<void>;
};

export async function seedGoldenPostgres(): Promise<SeededGoldenDataset> {
  const websiteId = randomUUID();
  const sessionIds = new Map(GOLDEN_DATASET.sessions.map(item => [item.id, randomUUID()]));
  const visitIds = new Map(
    GOLDEN_DATASET.events.map(item => item.visitId).map(id => [id, randomUUID()]),
  );

  await prisma.client.website.create({
    data: {
      id: websiteId,
      name: `M2 golden ${websiteId.slice(0, 8)}`,
      domain: `${websiteId}.golden.test`,
    },
  });

  await prisma.client.session.createMany({
    data: GOLDEN_DATASET.sessions.map(item => ({
      id: sessionIds.get(item.id),
      websiteId,
      distinctId: item.visitorId,
      createdAt:
        GOLDEN_DATASET.events.find(event => event.sessionId === item.id)?.occurredAt ??
        new Date('2026-03-11T04:00:00.000Z'),
    })),
  });

  await prisma.client.websiteEvent.createMany({
    data: GOLDEN_DATASET.events.map(item => ({
      id: randomUUID(),
      websiteId,
      sessionId: sessionIds.get(item.sessionId),
      visitId: visitIds.get(item.visitId),
      createdAt: item.occurredAt,
      urlPath: item.name === 'page_view' ? '/app' : '/app/onboarding',
      eventType: item.name === 'page_view' ? EVENT_TYPE.pageView : EVENT_TYPE.customEvent,
      eventName: item.name === 'page_view' ? null : item.name,
    })),
  });

  await prisma.client.sessionData.createMany({
    data: GOLDEN_DATASET.sessions.flatMap(item =>
      [
        item.userId
          ? {
              id: randomUUID(),
              websiteId,
              sessionId: sessionIds.get(item.id),
              distinctId: item.visitorId,
              dataKey: 'user_id',
              stringValue: item.userId,
              dataType: DATA_TYPE.string,
              createdAt:
                GOLDEN_DATASET.events.find(event => event.sessionId === item.id)?.occurredAt ??
                new Date('2026-03-11T04:00:00.000Z'),
            }
          : null,
        item.accountId
          ? {
              id: randomUUID(),
              websiteId,
              sessionId: sessionIds.get(item.id),
              distinctId: item.visitorId,
              dataKey: 'account_id',
              stringValue: item.accountId,
              dataType: DATA_TYPE.string,
              createdAt:
                GOLDEN_DATASET.events.find(event => event.sessionId === item.id)?.occurredAt ??
                new Date('2026-03-11T04:00:00.000Z'),
            }
          : null,
      ].filter(item => item !== null),
    ),
  });

  return {
    websiteId,
    cleanup: async () => {
      await prisma.client.eventData.deleteMany({ where: { websiteId } });
      await prisma.client.sessionData.deleteMany({ where: { websiteId } });
      await prisma.client.websiteEvent.deleteMany({ where: { websiteId } });
      await prisma.client.session.deleteMany({ where: { websiteId } });
      await prisma.client.website.deleteMany({ where: { id: websiteId } });
    },
  };
}
