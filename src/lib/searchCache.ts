/**
 * Bounded in-memory search result cache.
 *
 * The index only changes when content is reindexed and the server restarts, so
 * a per-process cache cannot serve stale results under the current deployment
 * model. Multi-instance deployments each keep their own; that is fine, since a
 * miss only costs what every request costs today.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface SearchCacheOptions {
  /** Entry lifetime. Zero or negative disables the cache entirely. */
  ttlMs?: number;
  maxEntries?: number;
  cleanupIntervalMs?: number;
}

export interface SearchCache<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  /** Drop every entry. Used when a process wants a clean slate. */
  clear: () => void;
  readonly size: number;
  readonly enabled: boolean;
}

/**
 * Cache key for a query. Case and surrounding whitespace are normalized away,
 * so "Deploy" and "deploy " share an entry. Their embeddings would differ
 * slightly and could rank results differently; collapsing them is a deliberate
 * trade of exactness for a lower call count.
 */
export function searchCacheKey(query: string, limit: number): string {
  return `${limit}:${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/**
 * Create an isolated cache. Expired entries are swept opportunistically on
 * reads rather than on a timer, so the cache never keeps a process alive.
 */
export function createSearchCache<T>(
  options: SearchCacheOptions = {},
): SearchCache<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries =
    options.maxEntries && options.maxEntries > 0
      ? options.maxEntries
      : DEFAULT_MAX_ENTRIES;
  const cleanupIntervalMs =
    options.cleanupIntervalMs && options.cleanupIntervalMs > 0
      ? options.cleanupIntervalMs
      : CLEANUP_INTERVAL_MS;

  const enabled = ttlMs > 0;
  const store = new Map<string, CacheEntry<T>>();
  let nextCleanupTime = 0;

  function cleanupExpiredEntries(now: number): void {
    for (const [key, entry] of store.entries()) {
      if (now >= entry.expiresAt) store.delete(key);
    }
  }

  function evictEarliestExpiry(): void {
    let candidate: string | undefined;
    let earliest = Number.POSITIVE_INFINITY;

    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt < earliest) {
        candidate = key;
        earliest = entry.expiresAt;
      }
    }

    if (candidate !== undefined) store.delete(candidate);
  }

  return {
    get(key) {
      if (!enabled) return undefined;

      const now = Date.now();
      if (now >= nextCleanupTime) {
        cleanupExpiredEntries(now);
        nextCleanupTime = now + cleanupIntervalMs;
      }

      const entry = store.get(key);
      if (!entry) return undefined;

      if (now >= entry.expiresAt) {
        store.delete(key);
        return undefined;
      }

      return entry.value;
    },

    set(key, value) {
      if (!enabled) return;

      // Refresh in place so a repeated query does not evict a live neighbour.
      store.delete(key);
      while (store.size >= maxEntries) {
        evictEarliestExpiry();
      }

      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    clear() {
      store.clear();
      nextCleanupTime = 0;
    },

    get size() {
      return store.size;
    },

    get enabled() {
      return enabled;
    },
  };
}
