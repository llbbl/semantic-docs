/**
 * Turso client wrapper using libsql-search
 */

import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;

export function getTursoClient(): Client {
  if (!client) {
    const url = import.meta.env.TURSO_DB_URL || process.env.TURSO_DB_URL;
    const authToken = import.meta.env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('TURSO_DB_URL and TURSO_AUTH_TOKEN are required');
    }

    client = createClient({ url, authToken });
  }

  return client;
}

// Re-export search utilities from libsql-search
export {
  getAllArticles,
  getArticleBySlug,
  getArticlesByFolder,
  getFolders
} from '@logan/libsql-search';
