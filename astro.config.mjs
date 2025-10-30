// @ts-check

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Choose adapter based on environment
const adapter =
  process.env.ADAPTER === 'cloudflare'
    ? cloudflare()
    : node({ mode: 'standalone' });

// Vite plugin to fix JSR package import paths
function fixJSRImports() {
  return {
    name: 'fix-jsr-imports',
    resolveId(/** @type {string} */ source) {
      // Fix incorrect relative imports from JSR packages
      /** @type {Record<string, string>} */
      const fixMap = {
        './@google/generative-ai': '@google/generative-ai',
        './openai': 'openai',
        './winston': 'winston',
      };

      if (fixMap[source]) {
        return { id: fixMap[source], external: true };
      }
      return null;
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), fixJSRImports()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      // Polyfill 'self' for ONNX runtime during SSR builds
      self: 'globalThis',
    },
    ssr: {
      // External packages that shouldn't be processed during SSR
      external: ['onnxruntime-node'],
      noExternal: ['@xenova/transformers'],
    },
  },
});
