/**
 * Validation utilities
 */

/**
 * Validate search query
 */
export function isValidSearchQuery(query: unknown): query is string {
  return typeof query === 'string' && query.trim().length >= 2;
}

/**
 * Validate embedding provider
 */
export function isValidEmbeddingProvider(
  provider: unknown,
): provider is 'local' | 'gemini' | 'openai' {
  return provider === 'local' || provider === 'gemini' || provider === 'openai';
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: unknown): slug is string {
  if (typeof slug !== 'string') return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Validate environment variables
 */
export interface EnvironmentConfig {
  TURSO_DB_URL: string;
  TURSO_AUTH_TOKEN: string;
  EMBEDDING_PROVIDER?: 'local' | 'gemini' | 'openai';
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export function validateEnvironment(
  env: Record<string, string | undefined>,
): EnvironmentConfig {
  if (!env.TURSO_DB_URL) {
    throw new Error('TURSO_DB_URL is required');
  }

  if (!env.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_AUTH_TOKEN is required');
  }

  const provider = env.EMBEDDING_PROVIDER || 'local';
  if (!isValidEmbeddingProvider(provider)) {
    throw new Error(
      `Invalid EMBEDDING_PROVIDER: ${provider}. Must be 'local', 'gemini', or 'openai'`,
    );
  }

  if (provider === 'gemini' && !env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required when using gemini provider');
  }

  if (provider === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when using openai provider');
  }

  return {
    TURSO_DB_URL: env.TURSO_DB_URL,
    TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN,
    EMBEDDING_PROVIDER: provider,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
  };
}
