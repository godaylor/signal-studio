import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/scripts/export-worker.ts'],
  bundle: true,
  outfile: 'generated/export-worker.mjs',
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  packages: 'external',
});
