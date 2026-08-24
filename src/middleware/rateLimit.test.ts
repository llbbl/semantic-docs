import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkRateLimit,
  createRateLimiter,
  createRateLimitHeaders,
  resolveClientId,
} from './rateLimit';

describe('resolveClientId', () => {
  it('uses the direct client address when proxy trust is disabled', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'x-real-ip': '203.0.113.11',
      },
    });

    expect(
      resolveClientId(request, { directClientAddress: '198.51.100.20' }),
    ).toBe('198.51.100.20');
  });

  it('falls back to unknown when no trusted or direct address is available', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    expect(resolveClientId(request)).toBe('unknown');
  });

  it('uses x-real-ip only when it is explicitly trusted and valid', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-real-ip': '203.0.113.12' },
    });

    expect(
      resolveClientId(request, {
        directClientAddress: '198.51.100.20',
        trustedProxyHeader: 'x-real-ip',
      }),
    ).toBe('203.0.113.12');
  });

  it('rejects malformed x-real-ip values and falls back to the direct address', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-real-ip': '203.0.113.12, 198.51.100.1' },
    });

    expect(
      resolveClientId(request, {
        directClientAddress: '198.51.100.20',
        trustedProxyHeader: 'x-real-ip',
      }),
    ).toBe('198.51.100.20');
  });

  it('uses a single trusted x-forwarded-for client address', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '203.0.113.30' },
    });

    expect(
      resolveClientId(request, {
        directClientAddress: '198.51.100.20',
        trustedProxyHeader: 'x-forwarded-for',
      }),
    ).toBe('203.0.113.30');
  });

  it('resolves the nearest untrusted x-forwarded-for address before trusted hops', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: {
        'x-forwarded-for': '203.0.113.30, 198.51.100.10, 198.51.100.11',
      },
    });

    expect(
      resolveClientId(request, {
        trustedProxyHeader: 'x-forwarded-for',
        trustedProxyHops: 1,
      }),
    ).toBe('198.51.100.10');

    expect(
      resolveClientId(request, {
        trustedProxyHeader: 'x-forwarded-for',
        trustedProxyHops: 2,
      }),
    ).toBe('203.0.113.30');
  });

  it('rejects malformed x-forwarded-for chains and falls back to the direct address', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '203.0.113.30, not-an-ip' },
    });

    expect(
      resolveClientId(request, {
        directClientAddress: '198.51.100.20',
        trustedProxyHeader: 'x-forwarded-for',
      }),
    ).toBe('198.51.100.20');
  });

  it('rejects invalid trusted hop counts and falls back to the direct address', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '203.0.113.30, 198.51.100.10' },
    });

    expect(
      resolveClientId(request, {
        directClientAddress: '198.51.100.20',
        trustedProxyHeader: 'x-forwarded-for',
        trustedProxyHops: 0,
      }),
    ).toBe('198.51.100.20');
  });

  it('accepts IPv6 addresses', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '2001:db8::1' },
    });

    expect(
      resolveClientId(request, {
        trustedProxyHeader: 'x-forwarded-for',
      }),
    ).toBe('2001:db8::1');
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    const limiter = createRateLimiter();
    const request = new Request('http://localhost/api/search.json');

    const result = limiter.checkRateLimit(request, {
      maxRequests: 5,
      windowSeconds: 60,
      directClientAddress: '198.51.100.1',
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('blocks requests over the limit', () => {
    const limiter = createRateLimiter();
    const request = new Request('http://localhost/api/search.json');
    const config = {
      maxRequests: 3,
      windowSeconds: 60,
      directClientAddress: '198.51.100.2',
    };

    expect(limiter.checkRateLimit(request, config).allowed).toBe(true);
    expect(limiter.checkRateLimit(request, config).allowed).toBe(true);
    expect(limiter.checkRateLimit(request, config).allowed).toBe(true);

    const blocked = limiter.checkRateLimit(request, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets after the window expires', () => {
    const limiter = createRateLimiter();
    const request = new Request('http://localhost/api/search.json');
    const config = {
      maxRequests: 2,
      windowSeconds: 60,
      directClientAddress: '198.51.100.3',
    };

    limiter.checkRateLimit(request, config);
    limiter.checkRateLimit(request, config);
    expect(limiter.checkRateLimit(request, config).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    const afterReset = limiter.checkRateLimit(request, config);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it('tracks different direct client addresses separately', () => {
    const limiter = createRateLimiter();
    const request = new Request('http://localhost/api/search.json');
    const baseConfig = { maxRequests: 2, windowSeconds: 60 };

    limiter.checkRateLimit(request, {
      ...baseConfig,
      directClientAddress: '198.51.100.4',
    });
    limiter.checkRateLimit(request, {
      ...baseConfig,
      directClientAddress: '198.51.100.4',
    });
    const blocked = limiter.checkRateLimit(request, {
      ...baseConfig,
      directClientAddress: '198.51.100.4',
    });
    const otherClient = limiter.checkRateLimit(request, {
      ...baseConfig,
      directClientAddress: '198.51.100.5',
    });

    expect(blocked.allowed).toBe(false);
    expect(otherClient.allowed).toBe(true);
  });

  it('does not let spoofed proxy headers create arbitrary buckets when trust is disabled', () => {
    const limiter = createRateLimiter();
    const config = {
      maxRequests: 2,
      windowSeconds: 60,
      directClientAddress: '198.51.100.6',
    };
    const reqA = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '203.0.113.1' },
    });
    const reqB = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '203.0.113.2' },
    });

    expect(limiter.checkRateLimit(reqA, config).remaining).toBe(1);
    expect(limiter.checkRateLimit(reqB, config).remaining).toBe(0);
    expect(limiter.checkRateLimit(reqA, config).allowed).toBe(false);
  });

  it('shares one unknown bucket for malformed or unattributed requests', () => {
    const limiter = createRateLimiter();
    const config = {
      maxRequests: 2,
      windowSeconds: 60,
      trustedProxyHeader: 'x-forwarded-for' as const,
    };
    const malformed = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': 'not-an-ip' },
    });
    const missing = new Request('http://localhost/api/search.json');

    expect(limiter.checkRateLimit(malformed, config).remaining).toBe(1);
    expect(limiter.checkRateLimit(missing, config).remaining).toBe(0);
    expect(limiter.checkRateLimit(malformed, config).allowed).toBe(false);
  });

  it('cleans expired entries opportunistically without keeping a timer alive', () => {
    const limiter = createRateLimiter({ cleanupIntervalMs: 1 });
    const request = new Request('http://localhost/api/search.json');
    const config = { maxRequests: 5, windowSeconds: 1 };

    limiter.checkRateLimit(request, {
      ...config,
      directClientAddress: '198.51.100.7',
    });
    limiter.checkRateLimit(request, {
      ...config,
      directClientAddress: '198.51.100.8',
    });
    expect(limiter.size).toBe(2);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(1_001);

    limiter.checkRateLimit(request, {
      ...config,
      directClientAddress: '198.51.100.9',
    });
    expect(limiter.size).toBe(1);
  });

  it('bounds the in-memory store by evicting the earliest reset bucket', () => {
    const limiter = createRateLimiter();
    const request = new Request('http://localhost/api/search.json');
    const config = { maxRequests: 5, windowSeconds: 60, maxEntries: 2 };

    limiter.checkRateLimit(request, {
      ...config,
      directClientAddress: '198.51.100.10',
    });
    vi.advanceTimersByTime(1_000);
    limiter.checkRateLimit(request, {
      ...config,
      directClientAddress: '198.51.100.11',
    });
    vi.advanceTimersByTime(1_000);
    limiter.checkRateLimit(request, {
      ...config,
      directClientAddress: '198.51.100.12',
    });

    expect(limiter.size).toBe(2);
    expect(
      limiter.checkRateLimit(request, {
        ...config,
        directClientAddress: '198.51.100.10',
      }).remaining,
    ).toBe(4);
  });

  it('uses default config values for the process-wide limiter', () => {
    const request = new Request('http://localhost/api/search.json');
    const result = checkRateLimit(request);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
  });
});

describe('createRateLimitHeaders', () => {
  it('creates correct headers', () => {
    const result = {
      allowed: true,
      limit: 10,
      remaining: 7,
      resetTime: 1_700_000_000_000,
    };

    const headers = createRateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('7');
    expect(headers['X-RateLimit-Reset']).toBe('1700000000');
  });
});
