import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name).split(path.sep).join('/');
    if (['src/generated', 'public/legal', 'public/script.js', 'public/recorder.js'].includes(file)) return [];
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}

export function sourceFingerprint() {
  // Docker injects an exact copy of docker/proxy.ts. Count that input once;
  // record the effective build profile separately in BUILD_METADATA.
  const files = [...['src', 'scripts', 'prisma', 'public', 'docker', 'docs/licenses', '.github', 'tests'].flatMap(walk),
    ...readdirSync('.').filter(file => /^(package\.json|pnpm-.*\.ya?ml|.*config[^/]*\.(ts|json|js|mjs|cjs)|Dockerfile|LICENSE|THIRD_PARTY_NOTICES\.md|\.npmrc|\.nvmrc|\.dockerignore)$/.test(file))]
    .filter(file => file !== 'src/proxy.ts' || !existsSync('docker/proxy.ts') || sha256(readFileSync(file)) !== sha256(readFileSync('docker/proxy.ts')))
    .sort();
  const entries = files.map(file => ({ file, sha256: sha256(readFileSync(file)) }));
  return { sourceSha256: sha256(entries.map(entry => `${entry.file}\0${entry.sha256}`).join('\n')), entries };
}
