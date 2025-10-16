/**
 * Vector Search API Endpoint
 * Uses libsql-search for semantic search
 */

import { search } from '@logan/libsql-search';
import { logger } from '@logan/logger';
import type { APIRoute } from 'astro';
import { getTursoClient } from '../../lib/turso';
import {
  checkRateLimit,
  createRateLimitHeaders,
} from '../../middleware/rateLimit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Rate limiting: 20 requests per minute per IP
  const rateLimitResult = checkRateLimit(request, {
    maxRequests: 20,
    windowSeconds: 60,
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

  try {
    const body = await request.json();
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
    const sanitizedLimit = Math.min(Math.max(1, limit), 20);

    const client = getTursoClient();

    // Perform vector search
    const results = await search({
      client,
      query,
      limit: sanitizedLimit,
      embeddingOptions: {
        provider:
          ((import.meta.env.EMBEDDING_PROVIDER ||
            process.env.EMBEDDING_PROVIDER) as 'local' | 'gemini' | 'openai') ||
          'local',
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
    logger.error('Search error:', error);

    return new Response(
      JSON.stringify({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
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
