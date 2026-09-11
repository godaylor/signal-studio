import { spawn } from 'node:child_process';

// Both children share the same release, database and durable export directory.
// A failed worker makes the deployment fail, rather than silently queueing forever.
export function supervise(commands, { graceMs = 250_000, env = process.env } = {}) {
  const children = commands.map(args => spawn(process.execPath, args, { env, stdio: 'inherit' }));
  let stopping = false;
  let exitCode = 0;
  let timer;
  let resolve;
  const done = new Promise(res => {
    resolve = res;
  });
  const remaining = new Set(children);
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    for (const child of remaining) child.kill('SIGTERM');
    timer = setTimeout(() => {
      for (const child of remaining) child.kill('SIGKILL');
    }, graceMs);
    timer.unref();
  };
  for (const child of children) {
    child.on('error', () => stop(1));
    child.on('close', () => {
      remaining.delete(child);
      if (!stopping) stop(1);
      if (remaining.size === 0) {
        clearTimeout(timer);
        resolve(exitCode);
      }
    });
  }
  return { done, stop };
}
