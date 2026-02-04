/**
 * Vector Search API Endpoint
 * Uses libsql-search for semantic search
 */

import { search } from '@logan/libsql-search';
import { logger } from '@logan/logger';
import type { APIRoute } from 'astro';
import { env } from '@/lib/env';
import { getTursoClient } from '@/lib/turso';
import { checkRateLimit, createRateLimitHeaders } from '@/middleware/rateLimit';

export const prerender = false;

/**
 * Environment configuration for validateOrigin
 * Used to override environment detection in tests
 */
export interface ValidateOriginEnv {
  isDevelopment: boolean;
  isTest: boolean;
}

/**
 * Validate request origin to prevent CSRF attacks
 * Returns true if the origin is valid (same-origin or allowed)
 * @param request - The incoming request
 * @param siteUrl - The site's URL for origin comparison
 * @param envOverride - Optional environment override for testing
 */
export function validateOrigin(
  request: Request,
  siteUrl?: URL,
  envOverride?: ValidateOriginEnv,
): boolean {
  // Use provided env or fall back to actual env
  const currentEnv = envOverride ?? {
    isDevelopment: env.isDevelopment,
    isTest: env.isTest,
  };

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If no origin header, check referer (some browsers don't send origin on same-origin)
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  // No origin/referer could be a same-origin request or a non-browser client
  // For API security, we should require origin for POST requests
  if (!requestOrigin) {
    // Allow requests without origin in development/test
    if (currentEnv.isDevelopment || currentEnv.isTest) {
      return true;
    }
    // In production, reject requests without origin for POST
    return false;
  }

  // Check if origin matches the site URL
  if (siteUrl && requestOrigin === siteUrl.origin) {
    return true;
  }

  // Allow localhost in development/test
  if (currentEnv.isDevelopment || currentEnv.isTest) {
    const localhostPatterns = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https?:\/\/\[::1\](:\d+)?$/,
    ];
    return localhostPatterns.some((pattern) => pattern.test(requestOrigin));
  }

  return false;
}

/**
 * Security headers for API responses
 */
const securityHeaders = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Enable XSS protection in older browsers
  'X-XSS-Protection': '1; mode=block',
  // Content Security Policy for JSON API responses
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

export const POST: APIRoute = async ({ request, site }) => {
  // CSRF protection: validate origin
  if (!validateOrigin(request, site)) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Invalid request origin',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders,
        },
      },
    );
  }

  // Rate limiting: 20 requests per minute per IP
  // Use 'x-forwarded-for' for common proxy setups.
  // Change to 'x-real-ip' for nginx or undefined for direct connections.
  const rateLimitResult = checkRateLimit(request, {
    maxRequests: 20,
    windowSeconds: 60,
    trustedProxyHeader: 'x-forwarded-for',
  });

  const rateLimitHeaders = {
    'Content-Type': 'application/json',
    ...securityHeaders,
    ...createRateLimitHeaders(rateLimitResult),
  };

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000,
          ).toString(),
        },
      },
    );
  }

  // Parse request body with error handling
  let body: { query?: unknown; limit?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON',
        message: 'Request body must be valid JSON.',
      }),
      { status: 400, headers: rateLimitHeaders },
    );
  }

  try {
    const { query, limit = 10 } = body;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { status: 400, headers: rateLimitHeaders },
      );
    }

    // Limit query length to prevent abuse
    if (query.length > 500) {
      return new Response(
        JSON.stringify({
          error: 'Query too long',
          message: 'Query must be less than 500 characters',
        }),
        { status: 400, headers: rateLimitHeaders },
      );
    }

    // Limit max results to prevent excessive database queries
    let numericLimit = 10;
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      numericLimit = Math.floor(limit);
    } else if (typeof limit === 'string') {
      const parsed = Number.parseInt(limit, 10);
      if (Number.isFinite(parsed)) {
        numericLimit = parsed;
      }
    }
    const sanitizedLimit = Math.min(Math.max(1, numericLimit), 20);

    const client = getTursoClient();

    // Perform vector search using centralized env config
    const results = await search({
      client,
      query,
      limit: sanitizedLimit,
      embeddingOptions: {
        provider: 'local',
      },
    });

    return new Response(
      JSON.stringify({
        results,
        count: results.length,
        query,
      }),
      {
        status: 200,
        headers: rateLimitHeaders,
      },
    );
  } catch (error) {
    // Log detailed error server-side for debugging
    logger.error('Search error:', error);

    // Return generic error message to client to avoid leaking internal details
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        message: 'An error occurred while processing your search request.',
      }),
      {
        status: 500,
        headers: rateLimitHeaders,
      },
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Use POST method for search' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      ...securityHeaders,
      Allow: 'POST',
    },
  });
};
