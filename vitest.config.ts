import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Risolve l'alias "@/..." (vedi tsconfig "paths") anche dentro vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
