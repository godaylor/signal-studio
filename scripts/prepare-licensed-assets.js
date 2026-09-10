import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Explicit maintenance command, never a network step of a normal build.
const assets = [
  { file: 'src/assets/fonts/InterVariable.woff2', url: 'https://raw.githubusercontent.com/rsms/inter/353b61b9f4430d5f420d56605a6e7993e0941470/docs/font-files/InterVariable.woff2', gitBlob: '5a8d3e72ad7ffb62af3b146e1b1f54ab5813a212', license: 'OFL-1.1', author: 'The Inter Project Authors / Rasmus Andersson' },
  { file: 'docs/licenses/Inter-OFL.txt', url: 'https://raw.githubusercontent.com/rsms/inter/353b61b9f4430d5f420d56605a6e7993e0941470/LICENSE.txt', gitBlob: '9b2ca37b3ffc77391d8b2ebef4a974ef32bf46ea', license: 'OFL-1.1', author: 'The Inter Project Authors / Rasmus Andersson' },
];
mkdirSync('src/assets/fonts', { recursive: true }); mkdirSync('docs/licenses', { recursive: true });
for (const asset of assets) {
  let bytes;
  if (existsSync(asset.file)) bytes = readFileSync(asset.file);
  else {
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Asset download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (actual !== asset.gitBlob) throw new Error(`Git blob integrity mismatch: ${asset.file}`);
  asset.sha256 = createHash('sha256').update(bytes).digest('hex');
  if (!existsSync(asset.file)) writeFileSync(asset.file, bytes);
  console.log(`Verified ${asset.file}: ${asset.sha256}`);
}
writeFileSync('docs/licenses/pinned-assets.json', JSON.stringify(assets, null, 2) + '\n');
