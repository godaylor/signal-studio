import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { prepareStandalone } from '../../scripts/prepare-standalone.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('copies public and Next static assets into standalone output', () => {
  const root = mkdtempSync(join(tmpdir(), 'signal-studio-standalone-'));
  temporaryDirectories.push(root);

  mkdirSync(join(root, 'public'), { recursive: true });
  mkdirSync(join(root, 'generated', 'legal'), { recursive: true });
  mkdirSync(join(root, 'docs', 'licenses'), { recursive: true });
  mkdirSync(join(root, '.next', 'static', 'chunks'), { recursive: true });
  mkdirSync(join(root, '.next', 'standalone'), { recursive: true });
  writeFileSync(join(root, 'public', 'favicon.ico'), 'public-asset');
  writeFileSync(join(root, 'generated', 'legal', 'BUILD_METADATA.json'), '{}');
  writeFileSync(join(root, 'docs', 'licenses', 'test.txt'), 'license');
  writeFileSync(join(root, 'LICENSE'), 'license');
  writeFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'notices');
  writeFileSync(join(root, '.next', 'static', 'chunks', 'app.js'), 'static-asset');
  writeFileSync(join(root, '.next', 'standalone', 'server.js'), 'server');

  prepareStandalone(root);

  expect(readFileSync(join(root, '.next', 'standalone', 'public', 'favicon.ico'), 'utf8')).toBe(
    'public-asset',
  );
  expect(
    readFileSync(join(root, '.next', 'standalone', '.next', 'static', 'chunks', 'app.js'), 'utf8'),
  ).toBe('static-asset');
});
