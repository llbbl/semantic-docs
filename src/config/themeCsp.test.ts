/**
 * @vitest-environment node
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { themePrepaintScriptHash } from './themeCsp';
import { themePrepaintScript } from './themes';

const astroConfig = readFileSync(
  resolve(process.cwd(), './astro.config.mjs'),
  'utf8',
);

describe('themePrepaintScriptHash', () => {
  it('matches a freshly computed digest of the shipped script', () => {
    const expected = createHash('sha256')
      .update(themePrepaintScript, 'utf8')
      .digest('base64');

    expect(themePrepaintScriptHash).toBe(`sha256-${expected}`);
  });

  it('is a CSP hash source the browser will accept', () => {
    expect(themePrepaintScriptHash).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
  });

  it('is wired into the script-src directive rather than hardcoded', () => {
    expect(astroConfig).toContain(
      "import { themePrepaintScriptHash } from './src/config/themeCsp.ts';",
    );
    expect(astroConfig).toContain('hashes: [themePrepaintScriptHash]');
    expect(astroConfig).not.toContain('sha256-');
  });
});

describe('page content security policy', () => {
  it.each([
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "img-src 'self' data: https:",
  ])('declares %s', (directive) => {
    expect(astroConfig).toContain(`"${directive}"`);
  });

  it("never falls back to 'unsafe-inline'", () => {
    expect(astroConfig).not.toContain('unsafe-inline');
    expect(astroConfig).not.toContain('unsafe-eval');
  });
});
