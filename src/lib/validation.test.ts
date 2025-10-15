import { describe, expect, it } from 'vitest';
import {
  isValidEmbeddingProvider,
  isValidSearchQuery,
  isValidSlug,
  validateEnvironment,
} from './validation';

describe('isValidSearchQuery', () => {
  it('should return true for valid queries', () => {
    expect(isValidSearchQuery('test')).toBe(true);
    expect(isValidSearchQuery('hello world')).toBe(true);
  });

  it('should return false for queries less than 2 characters', () => {
    expect(isValidSearchQuery('a')).toBe(false);
    expect(isValidSearchQuery('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isValidSearchQuery(123)).toBe(false);
    expect(isValidSearchQuery(null)).toBe(false);
    expect(isValidSearchQuery(undefined)).toBe(false);
    expect(isValidSearchQuery({})).toBe(false);
  });

  it('should trim whitespace before checking length', () => {
    expect(isValidSearchQuery('  ')).toBe(false);
    expect(isValidSearchQuery('  a  ')).toBe(false);
    expect(isValidSearchQuery('  ab  ')).toBe(true);
  });
});

describe('isValidEmbeddingProvider', () => {
  it('should return true for valid providers', () => {
    expect(isValidEmbeddingProvider('local')).toBe(true);
    expect(isValidEmbeddingProvider('gemini')).toBe(true);
    expect(isValidEmbeddingProvider('openai')).toBe(true);
  });

  it('should return false for invalid providers', () => {
    expect(isValidEmbeddingProvider('invalid')).toBe(false);
    expect(isValidEmbeddingProvider('OPENAI')).toBe(false);
    expect(isValidEmbeddingProvider('')).toBe(false);
    expect(isValidEmbeddingProvider(123)).toBe(false);
    expect(isValidEmbeddingProvider(null)).toBe(false);
  });
});

describe('isValidSlug', () => {
  it('should return true for valid slugs', () => {
    expect(isValidSlug('hello')).toBe(true);
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('api-reference-2024')).toBe(true);
    expect(isValidSlug('test123')).toBe(true);
  });

  it('should return false for invalid slugs', () => {
    expect(isValidSlug('Hello World')).toBe(false); // uppercase and space
    expect(isValidSlug('hello_world')).toBe(false); // underscore
    expect(isValidSlug('hello--world')).toBe(false); // double hyphen
    expect(isValidSlug('-hello')).toBe(false); // leading hyphen
    expect(isValidSlug('hello-')).toBe(false); // trailing hyphen
    expect(isValidSlug('hello world')).toBe(false); // space
    expect(isValidSlug('hello/world')).toBe(false); // slash
  });

  it('should return false for non-string values', () => {
    expect(isValidSlug(123)).toBe(false);
    expect(isValidSlug(null)).toBe(false);
    expect(isValidSlug(undefined)).toBe(false);
  });
});

describe('validateEnvironment', () => {
  it('should validate correct environment', () => {
    const env = {
      TURSO_DB_URL: 'libsql://test.turso.io',
      TURSO_AUTH_TOKEN: 'test-token',
      EMBEDDING_PROVIDER: 'local',
    };

    const result = validateEnvironment(env);

    expect(result.TURSO_DB_URL).toBe('libsql://test.turso.io');
    expect(result.TURSO_AUTH_TOKEN).toBe('test-token');
    expect(result.EMBEDDING_PROVIDER).toBe('local');
  });

  it('should default to local provider', () => {
    const env = {
      TURSO_DB_URL: 'libsql://test.turso.io',
      TURSO_AUTH_TOKEN: 'test-token',
    };

    const result = validateEnvironment(env);
    expect(result.EMBEDDING_PROVIDER).toBe('local');
  });

  it('should throw error for missing TURSO_DB_URL', () => {
    const env = {
      TURSO_AUTH_TOKEN: 'test-token',
    };

    expect(() => validateEnvironment(env)).toThrow('TURSO_DB_URL is required');
  });

  it('should throw error for missing TURSO_AUTH_TOKEN', () => {
    const env = {
      TURSO_DB_URL: 'libsql://test.turso.io',
    };

    expect(() => validateEnvironment(env)).toThrow(
      'TURSO_AUTH_TOKEN is required',
    );
  });

  it('should throw error for invalid embedding provider', () => {
    const env = {
      TURSO_DB_URL: 'libsql://test.turso.io',
      TURSO_AUTH_TOKEN: 'test-token',
      EMBEDDING_PROVIDER: 'invalid',
    };

    expect(() => validateEnvironment(env)).toThrow(
      'Invalid EMBEDDING_PROVIDER',
    );
  });

  it('should require GEMINI_API_KEY for gemini provider', () => {
    const env = {
      TURSO_DB_URL: 'libsql://test.turso.io',
      TURSO_AUTH_TOKEN: 'test-token',
      EMBEDDING_PROVIDER: 'gemini',
    };

    expect(() => validateEnvironment(env)).toThrow(
      'GEMINI_API_KEY is required',
    );
  });

  it('should require OPENAI_API_KEY for openai provider', () => {
    const env = {
      TURSO_DB_URL: 'libsql://test.turso.io',
      TURSO_AUTH_TOKEN: 'test-token',
      EMBEDDING_PROVIDER: 'openai',
    };

    expect(() => validateEnvironment(env)).toThrow(
      'OPENAI_API_KEY is required',
    );
  });

  it('should accept API keys when provider is set', () => {
    const env = {
      TURSO_DB_URL: 'libsql://test.turso.io',
      TURSO_AUTH_TOKEN: 'test-token',
      EMBEDDING_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-key',
    };

    const result = validateEnvironment(env);
    expect(result.GEMINI_API_KEY).toBe('test-key');
  });
});
