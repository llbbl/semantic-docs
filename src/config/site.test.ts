import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// site.ts resolves SITE_URL once at module load, so each case needs a fresh
// module registry rather than a re-read.
async function loadSite() {
  vi.resetModules();
  return await import('./site');
}

describe('site config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should fall back to localhost when SITE_URL is unset', async () => {
    vi.stubEnv('SITE_URL', '');

    const { siteUrl, FALLBACK_SITE_URL, isSiteUrlConfigured } =
      await loadSite();

    expect(siteUrl).toBe(FALLBACK_SITE_URL);
    expect(siteUrl).toBe('http://localhost:4321');
    expect(isSiteUrlConfigured).toBe(false);
  });

  it('should never fall back to a plausible-looking placeholder domain', async () => {
    vi.stubEnv('SITE_URL', '');

    const { siteUrl } = await loadSite();

    expect(siteUrl).not.toContain('example.com');
  });

  it('should use SITE_URL when it is set', async () => {
    vi.stubEnv('SITE_URL', 'https://docs.example.org');

    const { siteUrl, isSiteUrlConfigured, site } = await loadSite();

    expect(siteUrl).toBe('https://docs.example.org');
    expect(isSiteUrlConfigured).toBe(true);
    expect(site.siteUrl).toBe('https://docs.example.org');
  });

  it('should expose every identity field the theme renders', async () => {
    const { site } = await loadSite();

    expect(site).toMatchObject({
      name: expect.any(String),
      tagline: expect.any(String),
      logo: expect.any(String),
      repoUrl: expect.any(String),
      defaultDescription: expect.any(String),
      social: expect.any(Array),
    });
  });
});
