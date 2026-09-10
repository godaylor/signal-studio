import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'docs/licenses';
mkdirSync(directory, { recursive: true });
const manifestPath = `${directory}/sources.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const missing = JSON.parse(
  readFileSync('generated/legal/NOTICE_REVIEW.json', 'utf8'),
).missingNoticeText;
async function get(url, json = false) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { 'user-agent': 'Signal-Studio-license-inventory' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return json ? response.json() : response.text();
}
const overrides = {
  '@umami/react-zen': 'umami-software/zen',
  'rrweb-player': 'rrweb-io/rrweb',
  '@next/env': 'vercel/next.js',
  'client-only': 'vercel/next.js',
  '@biomejs/cli-win32-x64': 'biomejs/biome',
};
const heads = new Map();
for (const id of missing) {
  const split = id.lastIndexOf('@');
  const name = id.slice(0, split);
  const version = id.slice(split + 1);
  const destination = `${directory}/${name.replaceAll('/', '+')}@${version}.txt`;
  if (existsSync(destination)) continue;
  try {
    const metadata = await get(
      `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,
      true,
    );
    const repository =
      overrides[name] ??
      (typeof metadata.repository === 'string'
        ? metadata.repository
        : metadata.repository?.url
      )?.match(/github.com[/:]([^/]+\/[^/#]+?)(?:\.git)?(?:#.*)?$/)?.[1];
    if (!repository) throw new Error('No GitHub repository in exact-version metadata');
    let ref = metadata.gitHead;
    if (!ref) {
      if (!heads.has(repository))
        heads.set(
          repository,
          (await get(`https://api.github.com/repos/${repository}/commits/HEAD`, true)).sha,
        );
      ref = heads.get(repository);
    }
    let content;
    let url;
    const paths = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'UNLICENSE'];
    if (name === '@swc/counter') paths.unshift('packages/counter/LICENSE.txt');
    if (repository === 'biomejs/biome') paths.unshift('LICENSE-MIT');
    for (const file of paths) {
      url = `https://raw.githubusercontent.com/${repository}/${ref}/${file}`;
      try {
        content = await get(url);
        break;
      } catch (error) {
        if (!String(error).includes('404')) throw error;
      }
    }
    if (!content) throw new Error('License file not found at source revision');
    writeFileSync(destination, content);
    manifest[id] = {
      url,
      sourceRevision: ref,
      exactPublishedRevision: Boolean(metadata.gitHead),
      declaredLicense: metadata.license,
      sha256: createHash('sha256').update(content).digest('hex'),
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Verified ${id}`);
  } catch (error) {
    console.log(`UNRESOLVED ${id}: ${error.message}`);
  }
}
