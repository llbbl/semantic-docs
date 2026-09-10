import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMBEDDING_DIMENSIONS,
  getEmbeddingOptions,
  SEARCH_TABLE_NAME,
} from './searchConfig';

describe('searchConfig', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account-id');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'test-api-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // A half-finished provider swap that changes one without the other leaves the
  // table width and the vectors mismatched, which otherwise only fails at query
  // time against a real database.
  it('names the table after its vector width', () => {
    expect(SEARCH_TABLE_NAME).toContain(String(EMBEDDING_DIMENSIONS));
  });

  it('pins the width to the dimensions @cf/baai/bge-m3 returns', () => {
    expect(EMBEDDING_DIMENSIONS).toBe(1024);
  });

  it('builds Cloudflare options from the environment', () => {
    expect(getEmbeddingOptions()).toEqual({
      provider: 'cloudflare',
      accountId: 'test-account-id',
      apiToken: 'test-api-token',
      dimensions: EMBEDDING_DIMENSIONS,
    });
  });

  it('applies overrides without dropping credentials', () => {
    const controller = new AbortController();
    const options = getEmbeddingOptions({
      timeoutMs: 1234,
      signal: controller.signal,
    });

    expect(options.timeoutMs).toBe(1234);
    expect(options.signal).toBe(controller.signal);
    expect(options.accountId).toBe('test-account-id');
  });

  it.each(['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'])(
    'throws when %s is unset',
    (missingVar) => {
      vi.stubEnv(missingVar, '');
      expect(() => getEmbeddingOptions()).toThrow(missingVar);
    },
  );
});

describe('offline embedding provider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('replaces Workers AI when a base URL is configured', () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', 'http://127.0.0.1:8788/v1');

    expect(getEmbeddingOptions()).toEqual({
      provider: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:8788/v1',
      model: 'offline-hash',
      dimensions: EMBEDDING_DIMENSIONS,
    });
  });

  it('needs no Cloudflare credentials', () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', 'http://127.0.0.1:8788/v1');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '');

    expect(() => getEmbeddingOptions()).not.toThrow();
  });

  it('carries overrides through', () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', 'http://127.0.0.1:8788/v1');
    const controller = new AbortController();

    const options = getEmbeddingOptions({
      timeoutMs: 99,
      signal: controller.signal,
    });

    expect(options.timeoutMs).toBe(99);
    expect(options.signal).toBe(controller.signal);
  });

  // Two embedding spaces must never share a table: the vectors are not
  // comparable, and nothing at query time would report the mismatch.
  it('indexes into its own table', async () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', 'http://127.0.0.1:8788/v1');
    vi.resetModules();
    const offline = await import('./searchConfig');

    expect(offline.IS_OFFLINE_EMBEDDINGS).toBe(true);
    expect(offline.SEARCH_TABLE_NAME).not.toBe(SEARCH_TABLE_NAME);
    expect(offline.SEARCH_TABLE_NAME).toContain(String(EMBEDDING_DIMENSIONS));
    expect(offline.SEARCH_FTS_TABLE_NAME).toBe(
      `${offline.SEARCH_TABLE_NAME}_fts`,
    );
  });

  it('uses the Workers AI table when unset', async () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', '');
    vi.resetModules();
    const online = await import('./searchConfig');

    expect(online.IS_OFFLINE_EMBEDDINGS).toBe(false);
    expect(online.SEARCH_TABLE_NAME).toBe('articles_cf_bgem3_1024');
  });
});
