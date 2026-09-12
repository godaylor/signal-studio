// Test-only protocol fixture. Refuses real provider origins and non-test databases.
// NODE_OPTIONS=--import=./tests/fixtures/storage-provider.mjs for the E2E app only.
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
if (process.env.SUPABASE_URL !== 'https://signal-storage.invalid' || !new URL(process.env.DATABASE_URL).pathname.includes('_test_'))
  throw new Error('Storage fixture requires an isolated test database and reserved test origin.');
const original = globalThis.fetch;
const directory = path.resolve('.local/serverless-storage-test');
globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(typeof url === 'string' ? url : url.url || url);
  if (parsed.origin !== 'https://signal-storage.invalid') return original(url, options);
  const key = parsed.pathname.split('/').at(-1);
  const valid = value => /^[a-f0-9-]{36}\.[a-f0-9-]{36}\.bin$/.test(value);
  if (options.headers?.apikey !== process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response('{}', { status: 401 });
  await mkdir(directory, { recursive: true });
  if (options.method === 'DELETE') {
    for (const name of JSON.parse(options.body).prefixes) {
      if (!valid(name)) return new Response('{}', { status: 400 });
      await unlink(path.join(directory, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
    return new Response('[]');
  }
  if (!valid(key)) return new Response('{}', { status: 400 });
  if (options.method === 'POST') {
    await writeFile(path.join(directory, key), options.body, { flag: 'wx' });
    return new Response('{}');
  }
  try { return new Response(new Uint8Array(await readFile(path.join(directory, key)))); }
  catch { return new Response('{}', { status: 404 }); }
};
