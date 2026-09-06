import type { EmbeddingOptions } from '@logan/libsql-search';
import { getRequiredEnv } from './env';

export const SEARCH_TABLE_NAME = 'articles_cf_bgem3_1024';

// Fixed by @cf/baai/bge-m3, the only model Workers AI exposes through this
// adapter. The table's F32_BLOB width must equal it exactly.
export const EMBEDDING_DIMENSIONS = 1024;

// Query-time embedding is now a network call on the request path. The library
// default of 30s would hold a connection far past the point a search is useful.
export const SEARCH_EMBEDDING_TIMEOUT_MS = 5000;

/**
 * Cloudflare Workers AI credentials for indexing and query-time embedding.
 * Throws rather than returning a partial config, so a missing credential
 * surfaces at the call site instead of as an opaque upstream 4xx.
 */
export function getEmbeddingOptions(
  overrides?: Pick<EmbeddingOptions, 'timeoutMs' | 'signal'>,
): EmbeddingOptions {
  return {
    provider: 'cloudflare',
    accountId: getRequiredEnv('CLOUDFLARE_ACCOUNT_ID'),
    apiToken: getRequiredEnv('CLOUDFLARE_API_TOKEN'),
    // Sent so the provider rejects a width mismatch at config time; otherwise
    // the table width and the vectors could drift apart and only fail later at
    // query time.
    dimensions: EMBEDDING_DIMENSIONS,
    ...overrides,
  };
}
