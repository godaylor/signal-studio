/* eslint-disable no-console */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'signal-studio-tracker-types-'));

try {
  execFileSync(process.execPath, [
    'node_modules/typescript/bin/tsc',
    '-p',
    'tsconfig.tracker.types.json',
    '--outDir',
    temporaryDirectory,
  ], { stdio: 'inherit' });
  const generatedPath = join(temporaryDirectory, 'index.d.ts');
  execFileSync(
    process.execPath,
    ['node_modules/@biomejs/biome/bin/biome', 'format', '--write', generatedPath],
    { stdio: 'inherit' },
  );

  const generated = readFileSync(generatedPath, 'utf8').replaceAll('\r\n', '\n');
  const committed = readFileSync('src/tracker/index.d.ts', 'utf8').replaceAll('\r\n', '\n');
  if (generated !== committed) {
    console.error('Tracker declarations are stale. Run `pnpm update-tracker-types` and commit them.');
    process.exitCode = 1;
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
