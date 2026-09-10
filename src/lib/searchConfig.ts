import type { EmbeddingOptions } from '@logan/libsql-search';
import { env, getRequiredEnv } from './env';

// Deterministic local embeddings, so CI and fork PRs can index, prerender and
// search without credentials. Its vectors are a different embedding space from
// Workers AI, so it gets its own table rather than sharing one.
const OFFLINE_MODEL = 'offline-hash';

export const IS_OFFLINE_EMBEDDINGS = Boolean(env.offlineEmbeddingsBaseUrl);

export const SEARCH_TABLE_NAME = IS_OFFLINE_EMBEDDINGS
  ? 'articles_offline_hash_1024'
  : 'articles_cf_bgem3_1024';

// FTS5 index over the same rows, joined back by rowid = articles.id.
export const SEARCH_FTS_TABLE_NAME = `${SEARCH_TABLE_NAME}_fts`;

// Each retriever returns this multiple of the requested limit before fusion.
// Fusion can only reorder what it is given, so a keyword hit ranked 12th by
// bm25 is invisible if only the top 10 are fetched.
export const FUSION_CANDIDATE_MULTIPLIER = 3;

// Reciprocal rank fusion constant. 60 is the value from the original paper and
// the usual default; it damps the gap between rank 1 and rank 2 so a single
// retriever cannot dominate the merged list.
export const RRF_K = 60;

// Per-retriever weights, applied to each list's fusion contribution. Vector is
// trusted slightly more: search fires on short debounced queries, where bm25
// over OR-ed single tokens is at its noisiest, and a keyword artifact taking
// the top slot on a conversational query is the regression a docs search is
// judged on. Unequal by construction, so two retrievers can never tie exactly
// and no positional tie-break is needed. A tuning knob, not a constant of
// nature — revisit against a real corpus.
export const FUSION_WEIGHTS = {
  keyword: 0.85,
  vector: 1,
} as const;

// Fixed by @cf/baai/bge-m3, the only model Workers AI exposes through this
// adapter. The table's F32_BLOB width must equal it exactly. The offline
// provider matches it so both paths exercise the same schema.
export const EMBEDDING_DIMENSIONS = 1024;

// Query-time embedding is now a network call on the request path. The library
// default of 30s would hold a connection far past the point a search is useful.
export const SEARCH_EMBEDDING_TIMEOUT_MS = 5000;

/**
 * Embedding provider for indexing and query-time embedding. Throws rather than
 * returning a partial config, so a missing credential surfaces at the call site
 * instead of as an opaque upstream 4xx.
 */
export function getEmbeddingOptions(
  overrides?: Pick<EmbeddingOptions, 'timeoutMs' | 'signal'>,
): EmbeddingOptions {
  const offlineBaseUrl = env.offlineEmbeddingsBaseUrl;
  if (offlineBaseUrl) {
    return {
      provider: 'openai-compatible',
      baseUrl: offlineBaseUrl,
      model: OFFLINE_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      ...overrides,
    };
  }

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
