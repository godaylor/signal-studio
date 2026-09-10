/* eslint-disable no-console */
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve(process.cwd(), '.env');

if (existsSync(target)) {
  console.error('Refusing to overwrite existing .env. Remove it explicitly to generate a new one.');
  process.exit(1);
}

const appSecret = randomBytes(48).toString('base64url');
const twoFactorKey = randomBytes(32).toString('hex');
const contents = [
  '# Generated locally by `pnpm env:init`. Never commit this file.',
  'DATABASE_URL=postgresql://signal_studio:signal_studio@127.0.0.1:32110/signal_studio',
  `APP_SECRET=${appSecret}`,
  `TWO_FACTOR_ENCRYPTION_KEY=${twoFactorKey}`,
  '',
].join('\n');

writeFileSync(target, contents, { encoding: 'utf8', flag: 'wx' });
console.log('Created .env with cryptographically random application secrets.');
