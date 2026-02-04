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

  return {
    TURSO_DB_URL: env.TURSO_DB_URL,
    TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN,
  };
}
