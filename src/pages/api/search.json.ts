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

export const POST: APIRoute = async ({ request }) => {
  // Rate limiting: 20 requests per minute per IP
  // Enable trustProxy for deployments behind reverse proxies/CDNs
  const rateLimitResult = checkRateLimit(request, {
    maxRequests: 20,
    windowSeconds: 60,
    trustProxy: true,
  });

  const rateLimitHeaders = {
    'Content-Type': 'application/json',
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
        provider: env.embeddingProvider,
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
    headers: { 'Content-Type': 'application/json' },
  });
};
