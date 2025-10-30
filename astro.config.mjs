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

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
});
