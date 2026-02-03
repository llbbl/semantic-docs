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

/**
 * Trusted proxy header sources - in order of trust priority
 * cf-connecting-ip: Set by Cloudflare, cannot be spoofed by clients
 * x-real-ip: Set by nginx/other proxies, should be from trusted proxy only
 * x-forwarded-for: Can contain multiple IPs, last trusted proxy should be used
 */
export type TrustedProxyHeader =
  | 'cf-connecting-ip'
  | 'x-real-ip'
  | 'x-forwarded-for';

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /**
   * Trusted proxy header to use for client IP resolution
   * - 'cf-connecting-ip': Use when behind Cloudflare (most secure)
   * - 'x-real-ip': Use when behind nginx with real_ip module
   * - 'x-forwarded-for': Use with caution - only the rightmost non-private IP should be trusted
   * - undefined: Don't trust proxy headers (direct connections only)
   */
  trustedProxyHeader?: TrustedProxyHeader;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Validate IP address format (IPv4 or IPv6)
 * Prevents malicious header values from being used as rate limit keys
 */
function isValidIpAddress(ip: string): boolean {
  // IPv4 pattern
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 pattern (simplified - covers most valid formats)
  const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$|^(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,5}(?::[a-fA-F0-9]{1,4}){1,2}$|^(?:[a-fA-F0-9]{1,4}:){1,4}(?::[a-fA-F0-9]{1,4}){1,3}$|^(?:[a-fA-F0-9]{1,4}:){1,3}(?::[a-fA-F0-9]{1,4}){1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,2}(?::[a-fA-F0-9]{1,4}){1,5}$|^[a-fA-F0-9]{1,4}:(?::[a-fA-F0-9]{1,4}){1,6}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Get client identifier from request
 * @param request - The incoming request
 * @param trustedProxyHeader - Which proxy header to trust for IP resolution
 */
function getClientId(
  request: Request,
  trustedProxyHeader?: TrustedProxyHeader,
): string {
  if (trustedProxyHeader) {
    let proxyIp: string | null = null;

    switch (trustedProxyHeader) {
      case 'cf-connecting-ip':
        // Cloudflare header - most trusted, cannot be spoofed by clients
        proxyIp = request.headers.get('cf-connecting-ip');
        break;
      case 'x-real-ip':
        // nginx real_ip module - trusted if nginx is configured correctly
        proxyIp = request.headers.get('x-real-ip');
        break;
      case 'x-forwarded-for':
        // X-Forwarded-For format: "client, proxy1, proxy2, ..."
        // The leftmost IP is the original client IP as reported to the first proxy.
        // We take the leftmost IP because it represents the originating client.
        // Security note: The leftmost IP can be spoofed if upstream proxies don't
        // strip or validate existing X-Forwarded-For headers from incoming requests.
        // For higher security, prefer cf-connecting-ip or x-real-ip from trusted proxies.
        proxyIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
        break;
    }

    // Validate the IP to prevent header injection attacks
    if (proxyIp && isValidIpAddress(proxyIp)) {
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
  },
): RateLimitResult {
  const clientId = getClientId(request, config.trustedProxyHeader);
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
