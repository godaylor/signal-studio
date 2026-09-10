/* eslint-disable no-console */
import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { M4_DEMO_IDS, seedM4Demo } from './seed-m4-demo-data.js';

export const DEMO_IDS = Object.freeze({
  admin: '41e2b680-648e-4b09-bcd7-3e2b10c06264',
  workspace: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a001',
  membership: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a002',
  project: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003',
  replay: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a181',
});

export async function seedDemo(prisma) {
  const admin = await prisma.user.findUnique({
    where: { id: DEMO_IDS.admin },
    select: { id: true },
  });
  if (!admin) {
    throw new Error('Default admin is missing. Run `pnpm db:migrate` before `pnpm db:seed`.');
  }

  const workspace = await prisma.team.upsert({
    where: { id: DEMO_IDS.workspace },
    update: { name: 'Signal Studio Demo', deletedAt: null },
    create: { id: DEMO_IDS.workspace, name: 'Signal Studio Demo' },
  });
  await prisma.teamUser.upsert({
    where: { id: DEMO_IDS.membership },
    update: { teamId: workspace.id, userId: admin.id, role: 'team-owner' },
    create: {
      id: DEMO_IDS.membership,
      teamId: workspace.id,
      userId: admin.id,
      role: 'team-owner',
    },
  });
  const project = await prisma.website.upsert({
    where: { id: DEMO_IDS.project },
    update: {
      name: 'Signal Studio Demo Project',
      domain: 'demo.signal-studio.local',
      teamId: workspace.id,
      createdBy: admin.id,
      deletedAt: null,
      replayConfig: { replayEnabled: true, maskLevel: 'strict' },
    },
    create: {
      id: DEMO_IDS.project,
      name: 'Signal Studio Demo Project',
      domain: 'demo.signal-studio.local',
      teamId: workspace.id,
      createdBy: admin.id,
      replayConfig: { replayEnabled: true, maskLevel: 'strict' },
    },
  });

  const identity = await seedM4Demo(prisma, { projectId: project.id });
  const replayEvents = [
    {
      type: 4,
      timestamp: 1772964000000,
      data: { href: 'https://demo.signal-studio.local/app/onboarding', width: 1280, height: 720 },
    },
    {
      type: 2,
      timestamp: 1772964000001,
      data: {
        node: {
          type: 0,
          id: 1,
          childNodes: [
            {
              type: 2,
              id: 2,
              tagName: 'html',
              attributes: {},
              childNodes: [
                { type: 2, id: 3, tagName: 'head', attributes: {}, childNodes: [] },
                {
                  type: 2,
                  id: 4,
                  tagName: 'body',
                  attributes: {},
                  childNodes: [
                    {
                      type: 2,
                      id: 5,
                      tagName: 'main',
                      attributes: {},
                      childNodes: [
                        {
                          type: 3,
                          id: 6,
                          textContent: 'Signal Studio privacy-safe demo replay',
                          isStyle: false,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        initialOffset: { top: 0, left: 0 },
      },
    },
  ];
  await prisma.sessionReplay.createMany({
    skipDuplicates: true,
    data: [
      {
        id: DEMO_IDS.replay,
        websiteId: project.id,
        sessionId: M4_DEMO_IDS.aliceSession2,
        visitId: M4_DEMO_IDS.aliceVisit2,
        chunkIndex: 0,
        events: gzipSync(Buffer.from(JSON.stringify(replayEvents), 'utf8')),
        eventCount: replayEvents.length,
        startedAt: new Date('2026-03-08T10:00:00.000Z'),
        endedAt: new Date('2026-03-08T10:05:00.000Z'),
      },
    ],
  });

  return { workspaceId: workspace.id, projectId: project.id, identity };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }
  const url = new URL(databaseUrl);
  const adapter = new PrismaPg(
    { connectionString: url.toString() },
    { schema: url.searchParams.get('schema') },
  );
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await seedDemo(prisma);
    console.log(`Demo seed ready: workspace=${result.workspaceId} project=${result.projectId}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
