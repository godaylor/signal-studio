import { randomUUID } from 'node:crypto';
import type { TestInfo } from '@playwright/test';

export function createE2eFixtures(testInfo: TestInfo, label: string) {
  const token = `${testInfo.workerIndex}-${testInfo.retry}-${randomUUID().slice(0, 8)}`;
  const slug = `${label}-${token}`.toLowerCase();
  const username = `pw-${slug}`.slice(0, 80);

  return {
    user: {
      create: { username, password: 'Playwright-password-1', role: 'user' },
      update: { username, role: 'view-only' },
    },
    team: {
      create: { name: `PW ${slug}`.slice(0, 50) },
      update: { name: `PW updated ${slug}`.slice(0, 50) },
    },
    website: {
      create: { name: `PW ${slug}`.slice(0, 100), domain: `${slug}.example.test` },
      update: {
        name: `PW updated ${slug}`.slice(0, 100),
        domain: `updated-${slug}.example.test`,
      },
    },
  };
}
