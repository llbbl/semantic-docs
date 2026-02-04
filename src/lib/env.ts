/**
 * Centralized environment configuration
 * Provides type-safe access to environment variables
 */

/**
 * Get an environment variable from multiple sources
 * Checks import.meta.env first (Vite/Astro), then process.env (Node.js)
 * @param key - The environment variable key
 * @param defaultValue - Optional default value if not found
 * @returns The environment variable value or default
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  // Try Vite/Astro import.meta.env first
  const metaEnvValue =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env[key]
      : undefined;

  if (metaEnvValue !== undefined && metaEnvValue !== '') {
    return metaEnvValue;
  }

  // Fall back to process.env
  const processEnvValue =
    typeof process !== 'undefined' && process.env
      ? process.env[key]
      : undefined;

  if (processEnvValue !== undefined && processEnvValue !== '') {
    return processEnvValue;
  }

  return defaultValue;
}

/**
 * Get a required environment variable
 * Throws an error if the variable is not set
 * @param key - The environment variable key
 * @returns The environment variable value
 * @throws Error if the variable is not set
 */
export function getRequiredEnv(key: string): string {
  const value = getEnv(key);
  if (value === undefined || value === '') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Environment configuration object
 * Provides typed access to commonly used environment variables
 */
export const env = {
  /**
   * Turso database URL (libsql://...)
   */
  get tursoDbUrl(): string | undefined {
    return getEnv('TURSO_DB_URL');
  },

  /**
   * Turso authentication token
   */
  get tursoAuthToken(): string | undefined {
    return getEnv('TURSO_AUTH_TOKEN');
  },

  /**
   * Whether Turso credentials are configured
   */
  get hasTursoCredentials(): boolean {
    return Boolean(this.tursoDbUrl && this.tursoAuthToken);
  },

  /**
   * Node environment (development, production, test)
   */
  get nodeEnv(): string {
    return getEnv('NODE_ENV', 'development') as string;
  },

  /**
   * Whether running in production mode
   */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },

  /**
   * Whether running in development mode
   */
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  },

  /**
   * Whether running in test mode
   */
  get isTest(): boolean {
    return this.nodeEnv === 'test';
  },
} as const;
