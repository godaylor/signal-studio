/* eslint-disable no-console */
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function prepareStandalone(root = process.cwd()) {
  const standaloneDirectory = join(root, '.next', 'standalone');

  if (!existsSync(join(standaloneDirectory, 'server.js'))) {
    throw new Error('Next standalone output is missing. Run this script after `next build`.');
  }

  for (const relativeSource of ['public', join('.next', 'static')]) {
    const source = join(root, relativeSource);
    const destination = join(standaloneDirectory, relativeSource);

    if (!existsSync(source)) {
      throw new Error(`Required standalone asset directory is missing: ${relativeSource}`);
    }

    rmSync(destination, { recursive: true, force: true });
    cpSync(source, destination, { recursive: true, force: true });
  }

  // Next may copy loaded environment files separately from route tracing.
  // Remove only generated copies, never the operator's source configuration.
  for (const entry of readdirSync(standaloneDirectory, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name === '.env' || entry.name.startsWith('.env.'))) {
      rmSync(join(standaloneDirectory, entry.name));
    }
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md'])
    cpSync(join(root, name), join(standaloneDirectory, name));
  cpSync(join(root, 'generated/legal'), join(standaloneDirectory, 'legal'), { recursive: true });
  cpSync(join(root, 'docs/licenses'), join(standaloneDirectory, 'legal/sources'), {
    recursive: true,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import('./generate-release-inventory.js');
  prepareStandalone();
  console.log('Prepared standalone assets and legal notices; local environment files excluded.');
  await import('./verify-release-inventory.js');
}
