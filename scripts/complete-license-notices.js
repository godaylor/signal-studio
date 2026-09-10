import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = 'docs/licenses';
const manifest = JSON.parse(readFileSync(`${root}/sources.json`, 'utf8'));
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
const additions = [
  ['LGPL-3.0.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/3ac5a9c241d97f95b22a5e366c9c841404a35639/text/LGPL-3.0-only.txt'],
  ['GPL-3.0.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/3ac5a9c241d97f95b22a5e366c9c841404a35639/text/GPL-3.0-only.txt'],
  ['@swc+counter@0.1.3.txt', 'https://raw.githubusercontent.com/swc-project/pkgs/2cbd4700aaa6c28da488aad098b150c22ba56ff1/packages/counter/LICENSE.txt'],
  ['postgres@3.4.7.txt', 'https://raw.githubusercontent.com/porsager/postgres/9b92b65da6a5121545581a6dd5de859c2a70177f/UNLICENSE'],
  ['standard-MIT.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/3ac5a9c241d97f95b22a5e366c9c841404a35639/text/MIT.txt'],
  ['standard-ISC.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/3ac5a9c241d97f95b22a5e366c9c841404a35639/text/ISC.txt'],
  ['Datamaps-MIT.txt', 'https://raw.githubusercontent.com/markmarkoh/datamaps/14c1641273bb52e6f115f99db847ec076c62eb4b/LICENSE'],
  ['country-list-MIT.txt', 'https://raw.githubusercontent.com/umpirsky/country-list/bd490a163ae4709bbe4b54c4f638f24e032828d2/LICENSE'],
  ['language-list-MIT.txt', 'https://raw.githubusercontent.com/umpirsky/language-list/7813f6696559496d014acd5dce0e3b09c0766844/LICENSE'],
];
for (const [name, url] of additions) {
  const file = `${root}/${name}`;
  const bytes = existsSync(file) ? readFileSync(file) : await get(url);
  if (!existsSync(file)) writeFileSync(file, bytes);
  manifest[name] = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  console.log(`Verified ${name}`);
}
// These exact published packages declare MIT/ISC but contain no separate license
// document, and their source trees do not contain one either. Preserve the actual
// declaration and author; append a clearly labelled standard text, never invent
// an upstream copyright year or claim this is a recovered source LICENSE file.
for (const id of ['@open-draft/deferred-promise@2.2.0', '@prisma/dev@0.24.17', 'eastasianwidth@0.2.0', 'is-node-process@1.2.0', 'stackback@0.0.2']) {
  const split = id.lastIndexOf('@'); const name = id.slice(0, split); const version = id.slice(split + 1);
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
  const metadata = JSON.parse((await get(url)).toString());
  if (!['MIT', 'ISC'].includes(metadata.license)) throw new Error(`Unexpected declaration: ${id}`);
  const text = `${id}\nPublished license declaration: ${metadata.license}\nAuthor (verbatim package metadata): ${JSON.stringify(metadata.author ?? null)}\nSource: ${url}\nTarball integrity: ${metadata.dist.integrity}\n\nNo separate license/copyright document is published in this package. The following is the standard SPDX license text, not an invented upstream notice. Placeholder copyright fields belong to the standard template.\n\n${readFileSync(`${root}/standard-${metadata.license}.txt`, 'utf8')}`;
  writeFileSync(`${root}/${name.replaceAll('/', '+')}@${version}.txt`, text);
  manifest[id] = { url, evidence: 'published-license-declaration-and-author-with-standard-SPDX-text', declaredLicense: metadata.license, tarballIntegrity: metadata.dist.integrity, sha256: createHash('sha256').update(text).digest('hex') };
  console.log(`Recorded declaration-only notice: ${id}`);
}
writeFileSync(`${root}/sources.json`, JSON.stringify(manifest, null, 2) + '\n');
