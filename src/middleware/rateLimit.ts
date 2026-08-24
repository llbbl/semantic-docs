/**
 * Bounded in-memory rate limiter.
 * For production with multiple servers, use shared or edge rate limiting.
 */

import { isIP } from 'node:net';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export type TrustedProxyHeader = 'x-real-ip' | 'x-forwarded-for';

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Direct peer address supplied by the server adapter */
  directClientAddress?: string;
  /** Proxy header to trust only when the deployment explicitly enables it */
  trustedProxyHeader?: TrustedProxyHeader;
  /**
   * Number of trusted proxy hops at the right side of X-Forwarded-For.
   * The resolved client is the nearest untrusted address before those hops.
   */
  trustedProxyHops?: number;
  /** Maximum number of client buckets retained in this process */
  maxEntries?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

export interface RateLimiter {
  checkRateLimit: (
    request: Request,
    config?: RateLimitConfig,
  ) => RateLimitResult;
  readonly size: number;
}

export interface RateLimiterOptions {
  cleanupIntervalMs?: number;
}

function normalizeIpAddress(value: string | null | undefined): string | null {
  const address = value?.trim();
  return address && isIP(address) !== 0 ? address : null;
}

function getTrustedProxyAddress(
  request: Request,
  header: TrustedProxyHeader,
  trustedProxyHops: number,
): string | null {
  const value = request.headers.get(header);
  if (!value) return null;

  if (header === 'x-real-ip') {
    // X-Real-IP must be a single address written by the trusted proxy.
    return value.includes(',') ? null : normalizeIpAddress(value);
  }

  if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 1) {
    return null;
  }

  const chain = value.split(',').map((address) => address.trim());
  if (chain.length === 0 || chain.some((address) => isIP(address) === 0)) {
    return null;
  }

  const clientIndex = Math.max(0, chain.length - trustedProxyHops - 1);
  return chain[clientIndex] ?? null;
}

/**
 * Resolve the bucket identifier for a request.
 * Forwarding headers are ignored unless an explicit trusted header is set.
 */
export function resolveClientId(
  request: Request,
  config: Pick<
    RateLimitConfig,
    'directClientAddress' | 'trustedProxyHeader' | 'trustedProxyHops'
  > = {},
): string {
  if (config.trustedProxyHeader) {
    const proxyAddress = getTrustedProxyAddress(
      request,
      config.trustedProxyHeader,
      config.trustedProxyHops ?? 1,
    );
    if (proxyAddress) return proxyAddress;
  }

  return normalizeIpAddress(config.directClientAddress) ?? 'unknown';
}

/**
 * Create an isolated limiter. Expired entries are cleaned opportunistically on
 * requests, avoiding a referenced interval that can keep a process alive.
 */
export function createRateLimiter(
  options: RateLimiterOptions = {},
): RateLimiter {
  const store = new Map<string, RateLimitEntry>();
  const cleanupIntervalMs =
    options.cleanupIntervalMs && options.cleanupIntervalMs > 0
      ? options.cleanupIntervalMs
      : CLEANUP_INTERVAL_MS;
  let nextCleanupTime = 0;

  function cleanupExpiredEntries(now: number): void {
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }

  function evictEarliestReset(): void {
    let candidate: string | undefined;
    let earliestReset = Number.POSITIVE_INFINITY;

    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < earliestReset) {
        candidate = key;
        earliestReset = entry.resetTime;
      }
    }

    if (candidate !== undefined) {
      store.delete(candidate);
    }
  }

  function checkRateLimit(
    request: Request,
    config: RateLimitConfig = {
      maxRequests: 10,
      windowSeconds: 60,
    },
  ): RateLimitResult {
    const clientId = resolveClientId(request, config);
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const maxEntries =
      config.maxEntries &&
      Number.isSafeInteger(config.maxEntries) &&
      config.maxEntries > 0
        ? config.maxEntries
        : DEFAULT_MAX_ENTRIES;

    if (now >= nextCleanupTime) {
      cleanupExpiredEntries(now);
      nextCleanupTime = now + cleanupIntervalMs;
    }

    let entry = store.get(clientId);

    if (!entry || now >= entry.resetTime) {
      while (store.size >= maxEntries) {
        evictEarliestReset();
      }

      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(clientId, entry);
    }

    entry.count++;

    return {
      allowed: entry.count <= config.maxRequests,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  return {
    checkRateLimit,
    get size() {
      return store.size;
    },
  };
}

const defaultRateLimiter = createRateLimiter();

/** Check whether a request is rate limited by the process-wide limiter. */
export function checkRateLimit(
  request: Request,
  config?: RateLimitConfig,
): RateLimitResult {
  return defaultRateLimiter.checkRateLimit(request, config);
}

/** Create rate-limit response headers. */
export function createRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetTime / 1000).toString(),
  };
}
