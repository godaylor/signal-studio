import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
if (!new URL(process.env.DATABASE_URL ?? '').pathname.includes('_test_')) throw new Error('Release E2E requires an isolated _test_ database.');
const credentials = JSON.parse(await readFile(process.env.E2E_CREDENTIALS_FILE || '.local/credentials/administrator.json', 'utf8'));
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--project=chromium', ...args], {
  stdio: 'inherit',
  env: { ...process.env, UMAMI_USER: credentials.username, UMAMI_PASSWORD: credentials.password, PLAYWRIGHT_SKIP_WEB_SERVER: '1' },
});
process.exitCode = result.status ?? 1;
