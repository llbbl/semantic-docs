/**
 * Vector Search API Endpoint
 * Uses libsql-search for semantic search
 */

import { search } from '@logan/libsql-search';
import type { APIRoute } from 'astro';
import { logger } from 'logan-logger';
import { env } from '@/lib/env';
import { buildExcerpt } from '@/lib/excerpt';
import { createSearchCache, searchCacheKey } from '@/lib/searchCache';
import {
  getEmbeddingOptions,
  SEARCH_EMBEDDING_TIMEOUT_MS,
  SEARCH_TABLE_NAME,
} from '@/lib/searchConfig';
import { getTursoClient } from '@/lib/turso';
import { isValidSearchQuery } from '@/lib/validation';
import { checkRateLimit, createRateLimitHeaders } from '@/middleware/rateLimit';

export const prerender = false;

/**
 * Result shape sent to the client. The library's SearchResult carries the full
 * article body, which the UI never renders; shipping ten of those per debounced
 * keystroke is the payload this replaces.
 */
export interface SearchResultPayload {
  id: number;
  slug: string;
  title: string;
  folder: string;
  tags: string[];
  distance: number;
  excerpt: string;
}

/**
 * Process-wide cache of trimmed results. Caching after the trim keeps article
 * bodies out of memory, and the lookup happens before the Workers AI call so a
 * hit skips the billed request entirely.
 */
export const searchCache = createSearchCache<SearchResultPayload[]>({
  ttlMs: env.searchCacheTtlMs,
  maxEntries: env.searchCacheMaxEntries,
});

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

  // If no origin header, check referer (some browsers don't send origin on
  // same-origin requests). Treat malformed headers as invalid instead of
  // allowing URL parsing errors to escape the request handler.
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      return false;
    }
  }

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

  // Prefer the configured canonical site, but fall back to the actual request
  // origin so deployments without Astro.site can still validate same-origin
  // browser requests.
  const expectedOrigin = siteUrl?.origin ?? new URL(request.url).origin;
  if (requestOrigin === expectedOrigin) {
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

export const POST: APIRoute = async ({ request, site, clientAddress }) => {
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

  // Rate limiting: 20 requests per minute per resolved client identity.
  // Proxy headers remain disabled unless explicitly configured as trusted.
  const rateLimitResult = checkRateLimit(request, {
    maxRequests: 20,
    windowSeconds: 60,
    directClientAddress: clientAddress,
    trustedProxyHeader: env.rateLimitTrustedProxyHeader,
    trustedProxyHops: env.rateLimitTrustedProxyHops,
    maxEntries: env.rateLimitMaxEntries,
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

    if (typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { status: 400, headers: rateLimitHeaders },
      );
    }

    if (!isValidSearchQuery(query)) {
      return new Response(
        JSON.stringify({
          error: 'Query too short',
          message: 'Query must contain at least 2 non-whitespace characters',
        }),
        { status: 400, headers: rateLimitHeaders },
      );
    }

    const normalizedQuery = query.trim();

    // Limit query length to prevent abuse
    if (normalizedQuery.length > 500) {
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

    const cacheKey = searchCacheKey(normalizedQuery, sanitizedLimit);
    const cached = searchCache.get(cacheKey);

    if (cached) {
      return new Response(
        JSON.stringify({
          results: cached,
          count: cached.length,
          query: normalizedQuery,
        }),
        { status: 200, headers: rateLimitHeaders },
      );
    }

    const client = getTursoClient();

    // Perform vector search using centralized env config
    const matches = await search({
      client,
      query: normalizedQuery,
      limit: sanitizedLimit,
      tableName: SEARCH_TABLE_NAME,
      embeddingOptions: getEmbeddingOptions({
        timeoutMs: SEARCH_EMBEDDING_TIMEOUT_MS,
        // Abandon the upstream call when the client goes away.
        signal: request.signal,
      }),
    });

    const results: SearchResultPayload[] = matches.map((match) => ({
      id: match.id,
      slug: match.slug,
      title: match.title,
      folder: match.folder,
      tags: match.tags,
      distance: match.distance,
      excerpt: buildExcerpt(match.content, normalizedQuery),
    }));

    searchCache.set(cacheKey, results);

    return new Response(
      JSON.stringify({
        results,
        count: results.length,
        query: normalizedQuery,
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
