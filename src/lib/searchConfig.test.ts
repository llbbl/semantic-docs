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
