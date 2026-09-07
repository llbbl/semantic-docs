/**
 * Health Check Endpoint
 * Reports whether this instance can actually serve search, not merely whether
 * the process is up.
 */

import type { APIRoute } from 'astro';
import { logger } from 'logan-logger';
import { env } from '@/lib/env';
import { SEARCH_TABLE_NAME } from '@/lib/searchConfig';
import { getTursoClient } from '@/lib/turso';

export const prerender = false;

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  // An orchestrator polling this must never be handed a cached verdict.
  'Cache-Control': 'no-store',
};

/**
 * Reads from the search table rather than pinging the connection, so a
 * database that is reachable but was never indexed still reports unhealthy.
 */
async function isDatabaseReady(): Promise<boolean> {
  try {
    await getTursoClient().execute(
      `SELECT 1 FROM ${SEARCH_TABLE_NAME} LIMIT 1`,
    );
    return true;
  } catch (error) {
    logger.error('Health check: search table unavailable', error);
    return false;
  }
}

export const GET: APIRoute = async () => {
  const database = await isDatabaseReady();
  const embeddings = env.hasCloudflareCredentials;
  const healthy = database && embeddings;

  return new Response(
    JSON.stringify({
      status: healthy ? 'ok' : 'unhealthy',
      checks: { database, embeddings },
    }),
    {
      status: healthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    },
  );
};
