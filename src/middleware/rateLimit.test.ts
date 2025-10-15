import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, createRateLimitHeaders } from './rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests under the limit', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    const result = checkRateLimit(request, {
      maxRequests: 5,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('should block requests over the limit', () => {
    // Use unique IP to avoid interference from other tests
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '10.20.30.40' },
    });

    const config = { maxRequests: 3, windowSeconds: 60 };

    // Make 3 requests (at limit)
    const result1 = checkRateLimit(request, config);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = checkRateLimit(request, config);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = checkRateLimit(request, config);
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);

    // 4th request should be blocked
    const result4 = checkRateLimit(request, config);
    expect(result4.allowed).toBe(false);
    expect(result4.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    const config = { maxRequests: 2, windowSeconds: 60 };

    // Exceed limit
    checkRateLimit(request, config);
    checkRateLimit(request, config);
    const blocked = checkRateLimit(request, config);
    expect(blocked.allowed).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(61 * 1000);

    // Should be allowed again
    const afterReset = checkRateLimit(request, config);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it('should track different IPs separately', () => {
    const request1 = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    const request2 = new Request('http://localhost/api/search.json', {
      headers: { 'x-forwarded-for': '5.6.7.8' },
    });

    const config = { maxRequests: 2, windowSeconds: 60 };

    // Exhaust IP1
    checkRateLimit(request1, config);
    checkRateLimit(request1, config);
    const ip1Blocked = checkRateLimit(request1, config);
    expect(ip1Blocked.allowed).toBe(false);

    // IP2 should still work
    const ip2Result = checkRateLimit(request2, config);
    expect(ip2Result.allowed).toBe(true);
  });

  it('should handle CF-Connecting-IP header', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'cf-connecting-ip': '1.2.3.4' },
    });

    const result = checkRateLimit(request);
    expect(result.allowed).toBe(true);
  });

  it('should handle x-real-ip header', () => {
    const request = new Request('http://localhost/api/search.json', {
      headers: { 'x-real-ip': '1.2.3.4' },
    });

    const result = checkRateLimit(request);
    expect(result.allowed).toBe(true);
  });
});

describe('createRateLimitHeaders', () => {
  it('should create correct headers', () => {
    const result = {
      allowed: true,
      limit: 10,
      remaining: 7,
      resetTime: 1700000000000,
    };

    const headers = createRateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('7');
    expect(headers['X-RateLimit-Reset']).toBe('1700000000');
  });
});
