/* eslint-disable no-console */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import chalk from 'chalk';
import { PrismaClient } from '../generated/prisma/client.js';
import { getPrismaPgConfig } from './prisma-pg-config.js';

const MIN_VERSION = '15.0';
const MIN_VERSION_NUM = 150000;

if (process.env.SKIP_DB_CHECK) {
  console.log('Skipping database check.');
  process.exit(0);
}

function success(message) {
  console.log(chalk.greenBright(`✓ ${message}`));
}

function failure(message) {
  console.log(chalk.redBright(`✗ ${message}`));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined.');
  }
  success('DATABASE_URL is defined.');

  const url = new URL(process.env.DATABASE_URL);
  const adapter = new PrismaPg(getPrismaPgConfig(url.toString()), { schema: url.searchParams.get('schema') });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    success('Database connection successful.');

    const rows = await prisma.$queryRaw`select current_setting('server_version_num') as version_num`;
    const version = Number(rows[0]?.version_num);
    if (!Number.isFinite(version)) {
      throw new Error('Unable to determine database version.');
    }
    if (version < MIN_VERSION_NUM) {
      throw new Error(`Database version is not compatible. Upgrade to ${MIN_VERSION} or greater.`);
    }
    success('Database version check successful.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  failure(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
