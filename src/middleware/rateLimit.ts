/**
 * Simple in-memory rate limiter
 * For production with multiple servers, use Redis or edge rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Get client identifier from request
 */
function getClientId(request: Request): string {
  // Try to get IP from various headers (depending on deployment platform)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip =
    cfConnectingIp || realIp || forwarded?.split(',')[0]?.trim() || 'unknown';

  return ip;
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig = { maxRequests: 10, windowSeconds: 60 },
): RateLimitResult {
  const clientId = getClientId(request);
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
