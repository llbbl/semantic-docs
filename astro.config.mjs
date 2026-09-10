// @ts-check

import { existsSync } from 'node:fs';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { isSiteUrlConfigured, siteUrl } from './src/config/site.ts';

// Promote a local .env into process.env, the only source the server reads.
// Vite would otherwise surface these through import.meta.env, and an indexed
// read of that object serializes every variable present at build time into the
// bundle. Values already in the environment win, so this never overrides a
// real one.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Without `site`, Astro emits no canonical origin and every page's canonical,
// og:url, and twitter:url falls back to a placeholder. Warn rather than fail:
// dev and CI builds legitimately run without a public origin.
if (!isSiteUrlConfigured) {
  console.warn(
    `[site] SITE_URL is unset; canonical and Open Graph URLs will use ${siteUrl}. Set SITE_URL or edit src/config/site.ts before deploying.`,
  );
}

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  // Preserve Astro 6's HTML-aware whitespace handling after the Astro 7 upgrade.
  compressHTML: true,
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
