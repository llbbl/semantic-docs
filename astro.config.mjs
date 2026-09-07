// @ts-check

import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { isSiteUrlConfigured, siteUrl } from './src/config/site.ts';

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
