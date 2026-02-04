import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    server: {
      deps: {
        inline: ['@libsql/client'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '.astro/',
        '**/*.config.*',
        '**/scripts/**',
        '**/*.astro',
        '**/*.d.ts',
        '**/types/**',
        '**/config/**',
      ],
    },
  },
});
