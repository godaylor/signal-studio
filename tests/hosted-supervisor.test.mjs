import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supervise } from '../scripts/hosted-supervisor.js';

test('a failed child terminates its sibling and fails the deployment', async () => {
  const runtime = supervise(
    [
      ['-e', 'setTimeout(() => process.exit(2), 80)'],
      ['-e', 'setInterval(() => {}, 1000)'],
    ],
    { graceMs: 200 },
  );
  assert.equal(await runtime.done, 1);
});

test('operator shutdown terminates only owned children and exits cleanly', async () => {
  const runtime = supervise([['-e', 'setInterval(() => {}, 1000)']], { graceMs: 200 });
  runtime.stop();
  assert.equal(await runtime.done, 0);
});
