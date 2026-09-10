import esbuild from 'esbuild';

// Runtime preflight is outside Next's route graph. Bundle its own dependencies
// rather than assuming standalone contains development-time package symlinks.
await esbuild.build({
  entryPoints: ['scripts/check-runtime-db.js'],
  bundle: true,
  outfile: 'generated/check-runtime-db.mjs',
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  external: ['pg-native'],
});
