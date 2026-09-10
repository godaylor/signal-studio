import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sha256, sourceFingerprint } from './release-fingerprint.js';

const root = process.argv[2] || 'generated/legal';
const metadata = JSON.parse(readFileSync(path.join(root, 'BUILD_METADATA.json')));
assert.equal(metadata.fingerprintVersion, 2, 'Unsupported fingerprint version');
for (const [file, expected] of Object.entries(JSON.parse(readFileSync(path.join(root, 'ARTIFACT_HASHES.json'))))) {
  assert.equal(sha256(readFileSync(path.join(root, file))), expected, `Artifact changed: ${file}`);
}
assert.equal(sha256(readFileSync('LICENSE')), metadata.licenseSha256, 'LICENSE mismatch');
if (!process.argv.includes('--packaged')) {
  assert.equal(sourceFingerprint().sourceSha256, metadata.sourceSha256, 'Source changed after inventory generation');
  assert.equal(sha256(readFileSync('pnpm-lock.yaml')), metadata.lockfileSha256, 'Lockfile mismatch');
}
console.log(JSON.stringify({ verified: root, sourceSha256: metadata.sourceSha256, buildProfile: metadata.buildProfile }));
