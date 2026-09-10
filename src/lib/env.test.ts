import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, getEnv, getRequiredEnv } from './env';

const TEST_KEYS = [
  'TEST_KEY',
  'TURSO_DB_URL',
  'TURSO_AUTH_TOKEN',
  'NODE_ENV',
  'RATE_LIMIT_TRUSTED_PROXY_HEADER',
  'RATE_LIMIT_TRUSTED_PROXY_HOPS',
  'RATE_LIMIT_MAX_ENTRIES',
];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of TEST_KEYS) {
    delete process.env[key];
  }
});

describe('getEnv', () => {
  it('should return process.env when set', () => {
    process.env.TEST_KEY = 'process-value';

    expect(getEnv('TEST_KEY')).toBe('process-value');
  });

  it('should read process.env even when the value is empty elsewhere', () => {
    vi.stubEnv('TEST_KEY', '');
    process.env.TEST_KEY = 'process-value';

    expect(getEnv('TEST_KEY')).toBe('process-value');
  });

  it('should return default value when not set', () => {
    vi.stubEnv('TEST_KEY', '');
    delete process.env.TEST_KEY;

    expect(getEnv('TEST_KEY', 'default')).toBe('default');
  });
});

describe('getRequiredEnv', () => {
  it('should return value when present', () => {
    vi.stubEnv('TEST_KEY', 'required-value');

    expect(getRequiredEnv('TEST_KEY')).toBe('required-value');
  });

  it('should throw when missing or empty', () => {
    vi.stubEnv('TEST_KEY', '');

    expect(() => getRequiredEnv('TEST_KEY')).toThrow(
      'Required environment variable TEST_KEY is not set',
    );
  });
});

describe('env getters', () => {
  it('should expose Turso credentials', () => {
    vi.stubEnv('TURSO_DB_URL', 'libsql://test.turso.io');
    vi.stubEnv('TURSO_AUTH_TOKEN', 'test-token');

    expect(env.tursoDbUrl).toBe('libsql://test.turso.io');
    expect(env.tursoAuthToken).toBe('test-token');
    expect(env.hasTursoCredentials).toBe(true);
  });

  it('should report Workers AI credentials without exposing them', () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account-id');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'test-api-token');

    expect(env.hasCloudflareCredentials).toBe(true);
    // The token must not be reachable through the shared env object.
    expect(JSON.stringify(env)).not.toContain('test-api-token');
  });

  it.each([
    ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
  ])('should require %s alongside %s', (missingVar, presentVar) => {
    vi.stubEnv(presentVar, 'set');
    vi.stubEnv(missingVar, '');

    expect(env.hasCloudflareCredentials).toBe(false);
  });

  it('should default NODE_ENV to development', () => {
    vi.stubEnv('NODE_ENV', '');

    expect(env.nodeEnv).toBe('development');
    expect(env.isDevelopment).toBe(true);
    expect(env.isProduction).toBe(false);
    expect(env.isTest).toBe(false);
  });

  it('should reflect NODE_ENV variations', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(env.isProduction).toBe(true);

    vi.stubEnv('NODE_ENV', 'test');
    expect(env.isTest).toBe(true);
  });

  it('should expose supported rate limit proxy headers', () => {
    vi.stubEnv('RATE_LIMIT_TRUSTED_PROXY_HEADER', 'x-forwarded-for');
    expect(env.rateLimitTrustedProxyHeader).toBe('x-forwarded-for');

    vi.stubEnv('RATE_LIMIT_TRUSTED_PROXY_HEADER', 'x-real-ip');
    expect(env.rateLimitTrustedProxyHeader).toBe('x-real-ip');
  });

  it('should ignore unsupported rate limit proxy headers', () => {
    vi.stubEnv('RATE_LIMIT_TRUSTED_PROXY_HEADER', 'forwarded');

    expect(env.rateLimitTrustedProxyHeader).toBeUndefined();
  });

  it('should default invalid rate limit integers', () => {
    vi.stubEnv('RATE_LIMIT_TRUSTED_PROXY_HOPS', '0');
    vi.stubEnv('RATE_LIMIT_MAX_ENTRIES', 'not-a-number');

    expect(env.rateLimitTrustedProxyHops).toBe(1);
    expect(env.rateLimitMaxEntries).toBe(10_000);
  });

  it('should expose valid rate limit integers', () => {
    vi.stubEnv('RATE_LIMIT_TRUSTED_PROXY_HOPS', '2');
    vi.stubEnv('RATE_LIMIT_MAX_ENTRIES', '500');

    expect(env.rateLimitTrustedProxyHops).toBe(2);
    expect(env.rateLimitMaxEntries).toBe(500);
  });
});

describe('server env sources', () => {
  const serverEnvModules = ['src/lib/env.ts', 'src/lib/turso.ts'];

  it.each(serverEnvModules)(
    'should not read import.meta.env in %s',
    async (file) => {
      const source = await readFile(resolve(process.cwd(), file), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

      // Vite replaces import.meta.env at build time, and an indexed read
      // replaces the whole object, so every variable present during the build
      // is serialized into the bundle the container images ship.
      expect(code).not.toContain('import.meta.env');
    },
  );
});

describe('hybridSearchEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should default to enabled when unset', () => {
    expect(env.hybridSearchEnabled).toBe(true);
  });

  it.each(['false', 'FALSE', 'False', '0', 'off', 'OFF', '  false  '])(
    'should treat %s as disabled',
    (value) => {
      vi.stubEnv('SEARCH_HYBRID_ENABLED', value);
      expect(env.hybridSearchEnabled).toBe(false);
    },
  );

  it.each(['true', 'TRUE', '1', 'yes', 'anything'])(
    'should leave %s enabled',
    (value) => {
      vi.stubEnv('SEARCH_HYBRID_ENABLED', value);
      expect(env.hybridSearchEnabled).toBe(true);
    },
  );
});

describe('embedding provider configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the offline base URL when set', () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', 'http://127.0.0.1:8788/v1');

    expect(env.offlineEmbeddingsBaseUrl).toBe('http://127.0.0.1:8788/v1');
    expect(env.hasEmbeddingProvider).toBe(true);
  });

  it('accepts Workers AI credentials alone', () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', '');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'account');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token');

    expect(env.hasEmbeddingProvider).toBe(true);
  });

  it('accepts the offline service without Cloudflare credentials', () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', 'http://127.0.0.1:8788/v1');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '');

    expect(env.hasCloudflareCredentials).toBe(false);
    expect(env.hasEmbeddingProvider).toBe(true);
  });

  it('reports no provider when neither is configured', () => {
    vi.stubEnv('OFFLINE_EMBEDDINGS_BASE_URL', '');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '');

    expect(env.hasEmbeddingProvider).toBe(false);
  });
});
