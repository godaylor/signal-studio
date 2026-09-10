import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'src/features/{studio-shell,explore,insights,dashboards,audiences,experience}/**/*.spec.{ts,tsx}',
    ],
    setupFiles: ['./src/test/setup.ts', './src/test/studio-setup.ts'],
  },
});
