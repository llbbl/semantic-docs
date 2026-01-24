/**
 * Simple in-memory rate limiter
 * For production with multiple servers, use Redis or edge rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Cleanup interval for expired rate limit entries (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Trust proxy headers (x-forwarded-for, x-real-ip, cf-connecting-ip) */
  trustProxy?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Get client identifier from request
 * @param request - The incoming request
 * @param trustProxy - Whether to trust proxy headers for IP resolution
 */
function getClientId(request: Request, trustProxy = false): string {
  if (trustProxy) {
    // Try to get IP from various proxy headers (depending on deployment platform)
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    const realIp = request.headers.get('x-real-ip');
    const forwarded = request.headers.get('x-forwarded-for');

    const proxyIp =
      cfConnectingIp || realIp || forwarded?.split(',')[0]?.trim();

    if (proxyIp) {
      return proxyIp;
    }
  }

  // Fallback: generate a unique ID to prevent all unknown clients sharing one bucket
  // In production behind a proxy, this should rarely happen
  return `unknown-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig = {
    maxRequests: 10,
    windowSeconds: 60,
    trustProxy: false,
  },
): RateLimitResult {
  const clientId = getClientId(request, config.trustProxy);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = rateLimitStore.get(clientId);

  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(clientId, entry);
  }

  // Increment count
  entry.count++;

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetTime / 1000).toString(),
  };
}
