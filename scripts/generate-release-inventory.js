import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { sourceFingerprint } from './release-fingerprint.js';

const root = process.cwd();
const require = createRequire(import.meta.url);
const virtualStore = path.join(root, 'node_modules/.pnpm');
const yamlSlot = readdirSync(virtualStore).find(name => name.startsWith('js-yaml@'));
const { load } = require(path.join(virtualStore, yamlSlot, 'node_modules/js-yaml'));
const lock = load(readFileSync('pnpm-lock.yaml', 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const out = path.join(root, 'generated/legal');
mkdirSync(out, { recursive: true });
const components = new Map();
const texts = new Map();
const missing = [];
function inspect(directory) {
  const manifest = path.join(directory, 'package.json');
  if (!existsSync(manifest)) return;
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!pkg.name || !pkg.version) return;
  const id = `${pkg.name}@${pkg.version}`;
  if (!lock.packages?.[id]) return; // Ignore stale pnpm virtual-store leftovers.
  if (components.has(id)) return;
  const license =
    pkg.name === 'seq-queue' && pkg.version === '0.0.5'
      ? 'MIT'
      : typeof pkg.license === 'string'
        ? pkg.license
        : (pkg.license?.type ?? pkg.licenses?.map(item => item.type).join(' OR ') ?? 'NOASSERTION');
  const integrity = lock.packages?.[id]?.resolution?.integrity;
  const files = readdirSync(directory, { withFileTypes: true }).filter(
    item => item.isFile() && /^(licen[sc]e|copying|notice|copyright)([.-]|$)/i.test(item.name),
  );
  const notices = files.map(file => ({
    file: file.name,
    text: readFileSync(path.join(directory, file.name), 'utf8'),
  }));
  const supplemental = path.join(
    root,
    'docs/licenses',
    `${pkg.name.replaceAll('/', '+')}@${pkg.version}.txt`,
  );
  if (existsSync(supplemental))
    notices.push({ file: 'verified-upstream-license', text: readFileSync(supplemental, 'utf8') });
  if (!notices.length) {
    const sibling = pkg.name.startsWith('@esbuild/') ? `@esbuild+win32-x64@${pkg.version}.txt`
      : pkg.name.startsWith('@next/') ? `@next+env@${pkg.version}.txt`
      : pkg.name.startsWith('@rollup/rollup-') ? `@rollup+rollup-win32-x64-gnu@${pkg.version}.txt`
      : pkg.name.startsWith('@rolldown/binding-') ? `@rolldown+binding-win32-x64-msvc@${pkg.version}.txt`
      : pkg.name.startsWith('@biomejs/cli-') ? `@biomejs+cli-win32-x64@${pkg.version}.txt` : null;
    if (sibling && existsSync(path.join(root, 'docs/licenses', sibling))) notices.push({ file: `same-version-upstream-monorepo/${sibling}`, text: readFileSync(path.join(root, 'docs/licenses', sibling), 'utf8') });
  }
  if (!notices.length) {
    const readme = readdirSync(directory).find(name => /^readme(\.md)?$/i.test(name));
    if (readme) {
      const value = readFileSync(path.join(directory, readme), 'utf8');
      const match = value.match(/(?:^|\n)(?:#{1,3}\s*)?(?:licen[sc](?:e|ing)|copyright)[^\n]*\n[\s\S]*/i);
      if (match) notices.push({ file: readme, text: match[0] });
    }
  }
  if (!notices.length) missing.push(id);
  for (const notice of notices) {
    const hash = sha(notice.text);
    if (!texts.has(hash)) texts.set(hash, { packages: [], ...notice });
    texts.get(hash).packages.push(id);
  }
  const hashes = [];
  if (integrity?.startsWith('sha512-'))
    hashes.push({
      alg: 'SHA-512',
      content: Buffer.from(integrity.slice(7), 'base64').toString('hex'),
    });
  components.set(id, {
    type: 'library',
    'bom-ref': `pkg:npm/${pkg.name.replace('@', '%40')}@${pkg.version}`,
    name: pkg.name,
    version: pkg.version,
    purl: `pkg:npm/${pkg.name.replace('@', '%40')}@${pkg.version}`,
    licenses: [{ expression: license }],
    hashes,
    properties: [
      { name: 'signal-studio:package-json-sha256', value: sha(readFileSync(manifest)) },
      { name: 'signal-studio:scope', value: 'installed-build-and-runtime-superset' },
      { name: 'signal-studio:notice-files', value: notices.map(n => n.file).join(',') },
    ],
  });
}
for (const slot of readdirSync(virtualStore, { withFileTypes: true })) {
  if (!slot.isDirectory()) continue;
  const modules = path.join(virtualStore, slot.name, 'node_modules');
  if (!existsSync(modules)) continue;
  for (const entry of readdirSync(modules, { withFileTypes: true })) {
    const base = path.join(modules, entry.name);
    if (entry.name.startsWith('@')) {
      for (const child of readdirSync(base)) inspect(realpathSync(path.join(base, child)));
    } else if (!entry.name.startsWith('.')) inspect(realpathSync(base));
  }
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name).replaceAll('\\', '/');
    if (file === 'src/generated' || file === 'public/legal' || ['public/script.js','public/recorder.js'].includes(file)) return [];
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}
const { sourceSha256, entries } = sourceFingerprint();
writeFileSync(path.join(out, 'SOURCE_MANIFEST.json'), JSON.stringify(entries, null, 2) + '\n');
const upstream = 'ca661c7057984aa98ed4f7083d84dae2f65bfcb0';
const assets = [...walk('public'), ...walk('src/assets')].sort().map(file => ({ path: file, sha256: sha(readFileSync(file)), provenance: file.includes('/fonts/') ? 'docs/licenses/pinned-assets.json' : file.startsWith('public/intl/country/') ? 'Umami snapshot; umpirsky/country-list (MIT)' : file.startsWith('public/intl/language/') ? 'Umami snapshot; umpirsky/language-list (MIT)' : file === 'public/datamaps.world.json' ? 'Umami snapshot; Datamaps (MIT), Natural Earth (public domain)' : `Umami MIT source snapshot ${upstream}; Signal Studio modifications under root MIT`, source: `https://github.com/umami-software/umami/tree/${upstream}/${file}` }));
for (const asset of JSON.parse(readFileSync('docs/licenses/pinned-assets.json', 'utf8'))) {
  const entry = assets.find(item => item.path === asset.file);
  if (entry) entry.source = asset.url;
  if (sha(readFileSync(asset.file)) !== asset.sha256) throw new Error(`Pinned asset changed: ${asset.file}`);
}
writeFileSync(path.join(out, 'ASSET_PROVENANCE.json'), JSON.stringify({ upstream, assets, excluded: ['GeoLite2: not installed or bundled; licensed operator opt-in only'], note: 'Inherited assets retain the upstream MIT declaration and exact local hashes; this does not grant trademark rights or imply endorsement.' }, null, 2) + '\n');
let revision = process.env.SIGNAL_STUDIO_REVISION ?? 'source-checkout';
try {
  revision = process.env.SIGNAL_STUDIO_REVISION || execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {}
const metadata = {
  product: pkg.name,
  version: pkg.version,
  revision,
  sourceSha256,
  fingerprintVersion: 2,
  buildProfile: existsSync('src/proxy.ts') ? 'docker-proxy' : 'native',
  sourceState: 'Content fingerprint includes uncommitted source; revision alone is not the build identity.',
  lockfileSha256: sha(readFileSync('pnpm-lock.yaml')),
  licenseSha256: sha(readFileSync('LICENSE')),
  node: process.version,
  packageManager: pkg.packageManager,
  generatedAt: new Date().toISOString(),
  scope:
    'Installed dependencies (build and runtime superset); image SBOM separately describes each final image.',
};
writeFileSync(path.join(out, 'BUILD_METADATA.json'), JSON.stringify(metadata, null, 2) + '\n');
writeFileSync(
  path.join(out, 'application.cdx.json'),
  JSON.stringify(
    {
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      version: 1,
      metadata: {
        timestamp: metadata.generatedAt,
        component: { type: 'application', name: pkg.name, version: pkg.version },
      },
      components: [...components.values()].sort(
        (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
      ),
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  path.join(out, 'DEPENDENCY_LICENSES.txt'),
  [...texts.values()]
    .map(item => `${item.packages.sort().join(', ')}\nSource: ${item.file}\n${item.text}`)
    .join('\n\n----------------------------------------\n\n'),
);
writeFileSync(
  path.join(out, 'NOTICE_REVIEW.json'),
  JSON.stringify(
    {
      missingNoticeText: missing.sort(),
      unknownLicense: [...components.values()]
        .filter(c => c.licenses[0].expression === 'NOASSERTION')
        .map(c => `${c.name}@${c.version}`),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    components: components.size,
    licenseTexts: texts.size,
    missingNoticeText: missing.length,
    output: 'generated/legal',
  }),
);
cpSync('docs/licenses', path.join(out, 'sources'), { recursive: true });
cpSync('LICENSE', path.join(out, 'LICENSE.txt'));
cpSync('THIRD_PARTY_NOTICES.md', path.join(out, 'THIRD_PARTY_NOTICES.md'));
const artifactHashes = Object.fromEntries(walk(out).filter(file => !file.endsWith('/ARTIFACT_HASHES.json')).sort().map(file => [path.relative(out, file).split(path.sep).join('/'), sha(readFileSync(file))]));
writeFileSync(path.join(out, 'ARTIFACT_HASHES.json'), JSON.stringify(artifactHashes, null, 2) + '\n');
mkdirSync('public/legal', { recursive: true });
cpSync(out, 'public/legal', { recursive: true });
if (missing.length || [...components.values()].some(c => c.licenses[0].expression === 'NOASSERTION' || /AGPL/.test(c.licenses[0].expression))) {
  console.error(JSON.stringify({ unresolvedNotices: missing }));
  throw new Error('Release license inventory has unresolved packages; see NOTICE_REVIEW.json');
}
