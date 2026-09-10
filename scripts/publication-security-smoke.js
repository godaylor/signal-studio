import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';

// Only a task-owned server; the installed demo/DB are never touched.
const port = 32150;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', bytes => { output += bytes.toString(); });
child.stderr.on('data', bytes => { output += bytes.toString(); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error('Task server exited before readiness');
    if (output.includes('Ready in')) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Task server startup deadline');
  const project = '00000000-0000-4000-8000-000000000001';
  const token = jwt.sign({ type: 'share', shareId: 'deleted-record', websiteId: project }, process.env.APP_SECRET);
  for (const resource of ['stats', 'events', 'sessions']) {
    const response = await fetch(`${base}/api/websites/${project}/${resource}?startAt=1788825600000&endAt=1788912000000`, {
      headers: { 'x-umami-share-token': token, 'x-umami-share-context': 'website' },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 401, `Legacy token accepted by ${resource}`);
  }
  console.log('Bundled HTTP security: 3 legacy-token requests rejected (401); no database writes.');
} finally {
  child.kill();
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
}
