/**
 * Content Indexing Script
 * Uses libsql-search to index markdown files
 * Falls back to local libSQL if Turso credentials aren't available
 */

import { createClient } from '@libsql/client';
import { createTable, indexContent } from '@logan/libsql-search';
import { logger } from '@logan/logger';

// Initialize client (Turso or local libSQL)
const url = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client =
  url && authToken
    ? createClient({ url, authToken })
    : createClient({ url: 'file:local.db' });

if (!url || !authToken) {
  logger.info('Using local libSQL database (file:local.db)');
}

logger.info('Starting content indexing...');

// Create table if it doesn't exist
await createTable(client, 'articles', 768);

// Index content
const result = await indexContent({
  client,
  contentPath: './content',
  embeddingOptions: {
    provider:
      (process.env.EMBEDDING_PROVIDER as 'local' | 'gemini' | 'openai') ||
      'local',
    dimensions: 768,
  },
  onProgress: (current, total, file) => {
    logger.info(`[${current}/${total}] Indexing: ${file}`);
  },
});

logger.info(`Indexing complete!`);
logger.info(`Successfully indexed ${result.success}/${result.total} documents`);

if (result.failed > 0) {
  logger.warn(`Failed to index ${result.failed} documents`);
}
