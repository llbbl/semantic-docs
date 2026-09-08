import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearchCache, searchCacheKey } from './searchCache';

describe('searchCacheKey', () => {
  it('should normalize case and surrounding whitespace', () => {
    expect(searchCacheKey('  Deploy  ', 10)).toBe(searchCacheKey('deploy', 10));
  });

  it('should collapse internal whitespace', () => {
    expect(searchCacheKey('getting   started', 10)).toBe(
      searchCacheKey('getting started', 10),
    );
  });

  it('should treat different limits as different keys', () => {
    expect(searchCacheKey('deploy', 10)).not.toBe(searchCacheKey('deploy', 5));
  });

  it('should keep distinct queries distinct', () => {
    expect(searchCacheKey('deploy', 10)).not.toBe(searchCacheKey('search', 10));
  });
});

describe('createSearchCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should apply sane defaults when constructed with no options', () => {
    const cache = createSearchCache<number>();

    cache.set('k', 1);

    expect(cache.enabled).toBe(true);
    expect(cache.get('k')).toBe(1);
  });

  it('should return a stored value', () => {
    const cache = createSearchCache<string[]>({ ttlMs: 1000 });
    cache.set('k', ['a']);
    expect(cache.get('k')).toEqual(['a']);
  });

  it('should miss on an unknown key', () => {
    const cache = createSearchCache<string[]>({ ttlMs: 1000 });
    expect(cache.get('nope')).toBeUndefined();
  });

  it('should expire an entry once its TTL passes', () => {
    const cache = createSearchCache<string[]>({ ttlMs: 1000 });
    cache.set('k', ['a']);

    vi.advanceTimersByTime(999);
    expect(cache.get('k')).toEqual(['a']);

    vi.advanceTimersByTime(2);
    expect(cache.get('k')).toBeUndefined();
  });

  it('should be disabled when the TTL is zero', () => {
    const cache = createSearchCache<string[]>({ ttlMs: 0 });
    cache.set('k', ['a']);

    expect(cache.enabled).toBe(false);
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('should be disabled when the TTL is negative', () => {
    expect(createSearchCache({ ttlMs: -1 }).enabled).toBe(false);
  });

  it('should never exceed maxEntries', () => {
    const cache = createSearchCache<number>({ ttlMs: 10_000, maxEntries: 3 });

    for (let i = 0; i < 10; i++) {
      cache.set(`k${i}`, i);
    }

    expect(cache.size).toBe(3);
  });

  it('should evict the entry closest to expiry when full', () => {
    const cache = createSearchCache<number>({ ttlMs: 10_000, maxEntries: 2 });

    cache.set('oldest', 1);
    vi.advanceTimersByTime(10);
    cache.set('newer', 2);
    vi.advanceTimersByTime(10);
    cache.set('newest', 3);

    expect(cache.get('oldest')).toBeUndefined();
    expect(cache.get('newer')).toBe(2);
    expect(cache.get('newest')).toBe(3);
  });

  it('should refresh an existing key rather than grow', () => {
    const cache = createSearchCache<number>({ ttlMs: 1000, maxEntries: 5 });

    cache.set('k', 1);
    vi.advanceTimersByTime(500);
    cache.set('k', 2);

    expect(cache.size).toBe(1);
    expect(cache.get('k')).toBe(2);

    // The refreshed entry carries a full TTL from the second write.
    vi.advanceTimersByTime(600);
    expect(cache.get('k')).toBe(2);
  });

  it('should sweep expired entries without an interval timer', () => {
    const cache = createSearchCache<number>({
      ttlMs: 100,
      cleanupIntervalMs: 50,
    });

    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);

    vi.advanceTimersByTime(200);
    cache.get('anything');

    expect(cache.size).toBe(0);
  });

  it('should drop every entry on clear', () => {
    const cache = createSearchCache<number>({ ttlMs: 10_000 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('should keep working after a clear', () => {
    const cache = createSearchCache<number>({ ttlMs: 10_000 });

    cache.set('a', 1);
    cache.clear();
    cache.set('b', 2);

    expect(cache.get('b')).toBe(2);
  });

  it('should keep separate instances isolated', () => {
    const a = createSearchCache<number>({ ttlMs: 1000 });
    const b = createSearchCache<number>({ ttlMs: 1000 });

    a.set('k', 1);

    expect(b.get('k')).toBeUndefined();
  });
});
