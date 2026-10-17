import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Explicit maintenance command, never a network step of a normal build.
const assets = JSON.parse(readFileSync('docs/licenses/pinned-assets.json', 'utf8'));
mkdirSync('src/assets/fonts', { recursive: true }); mkdirSync('docs/licenses', { recursive: true });
for (const asset of assets) {
  if (asset.derivedFrom) {
    const source = assets.find(item => item.file === asset.derivedFrom);
    if (!source || source.sha256 !== asset.derivedFromSha256 ||
      createHash('sha256').update(readFileSync(source.file)).digest('hex') !== source.sha256) {
      throw new Error(`Converted font source mismatch: ${asset.file}`);
    }
    if (!existsSync(asset.file)) throw new Error(`Missing converted font: ${asset.file}. See docs/licenses/font-conversion.json for the explicit maintenance procedure.`);
    const actual = createHash('sha256').update(readFileSync(asset.file)).digest('hex');
    if (actual !== asset.sha256) throw new Error(`Converted font integrity mismatch: ${asset.file}`);
    console.log(`Verified ${asset.file}: ${actual}`);
    continue;
  }
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
