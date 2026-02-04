/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { type ValidateOriginEnv, validateOrigin } from './search.json';

// Environment configurations for testing
const productionEnv: ValidateOriginEnv = {
  isDevelopment: false,
  isTest: false,
};

const developmentEnv: ValidateOriginEnv = {
  isDevelopment: true,
  isTest: false,
};

const testEnv: ValidateOriginEnv = {
  isDevelopment: false,
  isTest: true,
};

// Helper to create a mock Request with specified headers
function createRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/search.json', {
    method: 'POST',
    headers,
  });
}

// Helper to create a URL object
function createSiteUrl(url: string): URL {
  return new URL(url);
}

describe('validateOrigin', () => {
  describe('valid origin header', () => {
    it('should return true when origin matches site URL', () => {
      const request = createRequest({ origin: 'https://example.com' });
      const siteUrl = createSiteUrl('https://example.com/some/path');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });

    it('should return true when origin matches site URL with port', () => {
      const request = createRequest({ origin: 'https://example.com:8080' });
      const siteUrl = createSiteUrl('https://example.com:8080/path');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });

    it('should return true when origin matches site URL with different paths', () => {
      const request = createRequest({ origin: 'https://docs.example.com' });
      const siteUrl = createSiteUrl('https://docs.example.com/api/search');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });
  });

  describe('valid referer header', () => {
    it('should return true when referer matches site URL (no origin)', () => {
      const request = createRequest({
        referer: 'https://example.com/some/page',
      });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });

    it('should extract origin from referer URL with path', () => {
      const request = createRequest({
        referer: 'https://example.com/deep/nested/page?query=test',
      });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });

    it('should prioritize origin header over referer', () => {
      // Origin doesn't match, but referer does - should fail because origin takes precedence
      const request = createRequest({
        origin: 'https://evil.com',
        referer: 'https://example.com/page',
      });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });
  });

  describe('invalid origin', () => {
    it('should return false when origin does not match', () => {
      const request = createRequest({ origin: 'https://evil.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should return false when origin protocol differs', () => {
      const request = createRequest({ origin: 'http://example.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should return false when origin port differs', () => {
      const request = createRequest({ origin: 'https://example.com:3000' });
      const siteUrl = createSiteUrl('https://example.com:8080');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });
  });

  describe('invalid referer', () => {
    it('should return false when referer does not match (no origin)', () => {
      const request = createRequest({
        referer: 'https://evil.com/page',
      });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should return false when referer has different subdomain', () => {
      const request = createRequest({
        referer: 'https://api.example.com/page',
      });
      const siteUrl = createSiteUrl('https://www.example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });
  });

  describe('missing both headers in production', () => {
    it('should return false when no origin or referer headers', () => {
      const request = createRequest({});
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should return false with empty origin header', () => {
      const request = createRequest({ origin: '' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      // Empty string is falsy, so requestOrigin becomes null
      expect(result).toBe(false);
    });
  });

  describe('development mode (localhost)', () => {
    it('should return true for localhost origin', () => {
      const request = createRequest({ origin: 'http://localhost' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should return true for localhost with port', () => {
      const request = createRequest({ origin: 'http://localhost:4321' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should return true for localhost with https', () => {
      const request = createRequest({ origin: 'https://localhost:3000' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should return true for 127.0.0.1', () => {
      const request = createRequest({ origin: 'http://127.0.0.1' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should return true for 127.0.0.1 with port', () => {
      const request = createRequest({ origin: 'http://127.0.0.1:8080' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should return true for IPv6 localhost [::1]', () => {
      const request = createRequest({ origin: 'http://[::1]' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should return true for IPv6 localhost [::1] with port', () => {
      const request = createRequest({ origin: 'http://[::1]:5173' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should return true when no origin/referer in development', () => {
      const request = createRequest({});
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should reject non-localhost external origins in development', () => {
      // In development, non-localhost origins that don't match siteUrl should be rejected
      const request = createRequest({ origin: 'https://evil.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      // The function checks localhost patterns in dev mode for non-matching origins
      expect(result).toBe(false);
    });
  });

  describe('test environment', () => {
    it('should return true when NODE_ENV is test and no headers', () => {
      const request = createRequest({});
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, testEnv);

      expect(result).toBe(true);
    });

    it('should return true for localhost origins in test', () => {
      const request = createRequest({ origin: 'http://localhost:4321' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, testEnv);

      expect(result).toBe(true);
    });

    it('should reject non-localhost external origins in test', () => {
      // In test mode, non-localhost origins that don't match siteUrl should be rejected
      const request = createRequest({ origin: 'https://malicious.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, testEnv);

      expect(result).toBe(false);
    });
  });

  describe('null/undefined siteUrl', () => {
    it('should handle undefined siteUrl gracefully in production', () => {
      const request = createRequest({ origin: 'https://example.com' });

      // siteUrl is undefined, so origin can't match - falls through to return false
      const result = validateOrigin(request, undefined, productionEnv);

      expect(result).toBe(false);
    });

    it('should allow localhost with undefined siteUrl in development', () => {
      const request = createRequest({ origin: 'http://localhost:3000' });

      const result = validateOrigin(request, undefined, developmentEnv);

      expect(result).toBe(true);
    });

    it('should allow missing headers with undefined siteUrl in test', () => {
      const request = createRequest({});

      const result = validateOrigin(request, undefined, testEnv);

      expect(result).toBe(true);
    });
  });

  describe('partial URL matches (security)', () => {
    it('should reject origins that are substrings of site URL', () => {
      // evil-example.com should NOT match example.com
      const request = createRequest({ origin: 'https://evil-example.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should reject origins with site URL as substring', () => {
      // example.com.evil.com should NOT match example.com
      const request = createRequest({ origin: 'https://example.com.evil.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should reject subdomain attacks', () => {
      // evil.example.com should NOT match example.com
      const request = createRequest({ origin: 'https://evil.example.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should reject prefix attacks', () => {
      // example.com.attacker.com should NOT match example.com
      const request = createRequest({
        origin: 'https://example.com.attacker.com',
      });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should reject similar domain names', () => {
      // examplecom.com should NOT match example.com
      const request = createRequest({ origin: 'https://examplecom.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });

    it('should reject typosquatting attempts', () => {
      // examp1e.com (with number 1) should NOT match example.com
      const request = createRequest({ origin: 'https://examp1e.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed referer URL by throwing', () => {
      // Create a request with a malformed referer
      // The URL constructor in the function will throw on invalid URLs
      const request = createRequest({
        referer: 'not-a-valid-url',
      });
      const siteUrl = createSiteUrl('https://example.com');

      // The URL constructor throws on invalid URLs
      expect(() => validateOrigin(request, siteUrl, productionEnv)).toThrow();
    });

    it('should handle origin with trailing slash correctly', () => {
      // URL.origin never includes trailing slash
      const request = createRequest({ origin: 'https://example.com' });
      const siteUrl = createSiteUrl('https://example.com/');

      const result = validateOrigin(request, siteUrl, productionEnv);

      // URL.origin for both should be 'https://example.com'
      expect(result).toBe(true);
    });

    it('should handle case-sensitive comparison (origins are normalized to lowercase)', () => {
      // URL constructor normalizes hosts to lowercase
      const request = createRequest({ origin: 'https://example.com' });
      const siteUrl = createSiteUrl('https://EXAMPLE.COM');

      // URL normalizes to lowercase, so this should match
      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });

    it('should handle URL with default port (https 443)', () => {
      // https://example.com and https://example.com:443 have the same origin
      // However, URL.origin includes port only if non-default
      const request = createRequest({ origin: 'https://example.com' });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });

    it('should handle URL with default port (http 80)', () => {
      // Set to development to allow http localhost
      const request = createRequest({ origin: 'http://localhost' });
      const siteUrl = createSiteUrl('http://localhost');

      const result = validateOrigin(request, siteUrl, developmentEnv);

      expect(result).toBe(true);
    });

    it('should handle referer with query parameters', () => {
      const request = createRequest({
        referer: 'https://example.com/search?q=test&page=1',
      });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });

    it('should handle referer with hash fragment', () => {
      const request = createRequest({
        referer: 'https://example.com/docs#section-1',
      });
      const siteUrl = createSiteUrl('https://example.com');

      const result = validateOrigin(request, siteUrl, productionEnv);

      expect(result).toBe(true);
    });
  });
});
