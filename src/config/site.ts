/**
 * Site identity — the one file to edit when rebranding this theme.
 * Consumed by the header, the layout's metadata, the landing page, and
 * `site` in astro.config.mjs.
 */

import { getEnv } from '../lib/env';

export interface SocialLink {
  label: string;
  href: string;
}

/**
 * Canonical origin, used for canonical/og/twitter URLs. Set SITE_URL in the
 * deployment environment, or edit the fallback. localhost rather than a
 * plausible-looking domain: an unset origin should be obviously unset in the
 * emitted markup, not quietly wrong on every page.
 */
export const FALLBACK_SITE_URL = 'http://localhost:4321';

export const siteUrl = getEnv('SITE_URL', FALLBACK_SITE_URL) as string;

/** True when the origin is still the placeholder, so callers can warn. */
export const isSiteUrlConfigured = siteUrl !== FALLBACK_SITE_URL;

export const site = {
  /** Shown next to the logo and used as the default page title. */
  name: 'Astro Vault',
  /** One-line lead on the landing page. */
  tagline: 'Your content is powered by libSQL with vector search capabilities.',
  /** Single character or short string rendered in the logo tile. */
  logo: 'A',
  /** Repository the header's icon links to. Set to '' to hide the icon. */
  repoUrl: 'https://github.com/llbbl/semantic-docs',
  /** Fallback <meta name="description"> for pages that supply none. */
  defaultDescription: 'Documentation',
  /** Extra header links. Empty by default, so the header is unchanged. */
  social: [] as SocialLink[],
  siteUrl,
} as const;
