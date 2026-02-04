import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, getEnv, getRequiredEnv } from './env';

const TEST_KEYS = ['TEST_KEY', 'TURSO_DB_URL', 'TURSO_AUTH_TOKEN', 'NODE_ENV'];

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

  it('should fall back to process.env when import.meta.env is empty', () => {
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
});
