/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applySecurityHeaders, SECURITY_HEADERS } from './securityHeaders';

const middleware = readFileSync(
  resolve(process.cwd(), './src/middleware/index.ts'),
  'utf8',
);

describe('applySecurityHeaders', () => {
  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ])('sets %s on a response that has none', (name, value) => {
    const headers = new Headers();

    applySecurityHeaders(headers);

    expect(headers.get(name)).toBe(value);
  });

  it('denies the sensitive Permissions-Policy features', () => {
    const headers = new Headers();

    applySecurityHeaders(headers);

    const policy = headers.get('Permissions-Policy') ?? '';
    for (const feature of ['camera', 'geolocation', 'microphone', 'payment']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('leaves a value a route already chose', () => {
    const headers = new Headers({ 'X-Frame-Options': 'SAMEORIGIN' });

    applySecurityHeaders(headers);

    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it("does not touch the API routes' own Content-Security-Policy", () => {
    const apiPolicy = "default-src 'none'; frame-ancestors 'none'";
    const headers = new Headers({ 'Content-Security-Policy': apiPolicy });

    applySecurityHeaders(headers);

    expect(headers.get('Content-Security-Policy')).toBe(apiPolicy);
  });

  it('preserves unrelated headers', () => {
    const headers = new Headers({ 'X-RateLimit-Remaining': '19' });

    applySecurityHeaders(headers);

    expect(headers.get('X-RateLimit-Remaining')).toBe('19');
  });

  it('carries no header a meta element could have set instead', () => {
    expect(Object.keys(SECURITY_HEADERS)).not.toContain(
      'Content-Security-Policy',
    );
  });

  // Response.redirect() returns immutable headers, where set() throws. Serving
  // the response without these beats failing the request.
  it('gives up quietly on immutable headers rather than throwing', () => {
    const headers = Response.redirect('https://example.com/', 302).headers;

    expect(() => applySecurityHeaders(headers)).not.toThrow();
    expect(headers.has('X-Content-Type-Options')).toBe(false);
  });
});

describe('middleware wiring', () => {
  it('applies the headers to every on-demand response', () => {
    expect(middleware).toContain(
      "import { applySecurityHeaders } from './securityHeaders';",
    );
    expect(middleware).toContain('applySecurityHeaders(response.headers)');
  });

  it('leaves CSP to the meta element Astro emits per page', () => {
    expect(middleware).not.toContain('Content-Security-Policy');
  });
});
