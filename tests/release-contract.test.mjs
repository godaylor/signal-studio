import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const slot = readdirSync('node_modules/.pnpm').find(name => name.startsWith('js-yaml@'));
const { load } = require(path.resolve('node_modules/.pnpm', slot, 'node_modules/js-yaml'));
const read = file => readFileSync(file, 'utf8');
test('publication depends on reusable CI with all quality and image gates', () => {
  const release = load(read('.github/workflows/cd.yml'));
  const ci = load(read('.github/workflows/ci.yml'));
  assert.equal(release.jobs.images.needs, 'verify');
  assert.equal(release.jobs.verify.uses, './.github/workflows/ci.yml');
  assert.ok(ci.on.includes('workflow_call'));
  const commands = ci.jobs.verify.steps.map(step => step.run || '').join('\n');
  for (const gate of ['pnpm db:migrate', 'pnpm typecheck', 'pnpm lint', 'pnpm test', 'pnpm test:integration', 'pnpm build', 'run-release-e2e.js', 'verify-release-inventory.js']) assert.ok(commands.includes(gate), gate);
  assert.deepEqual(ci.jobs.image.strategy.matrix.target, ['runner', 'worker', 'migration', 'hosted']);
  assert.equal(ci.jobs.image.needs, 'verify');
  assert.match(read('next.config.ts'), /ignoreBuildErrors: false/);
  assert.equal(existsSync('app.json'), false);
});
test('every original functional requirement is tracked exactly once', () => {
  const spec = [...read('docs/TRANSFORMATION_SPEC.md').matchAll(/^- `(FR-[A-Z]+-\d+)`/gm)].map(m => m[1]);
  const trace = [...read('docs/REQUIREMENTS_TRACEABILITY.md').matchAll(/^\| (FR-[A-Z]+-\d+) \|/gm)].map(m => m[1]);
  assert.equal(spec.length, 76);
  assert.deepEqual(trace.sort(), spec.sort());
});
