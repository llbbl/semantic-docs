/**
 * Content Indexing Script
 * Uses libsql-search to index markdown files
 */

import { createClient } from '@libsql/client';
import { createTable, indexContent } from '@logan/libsql-search';
import { logger } from '@logan/logger';

// Initialize Turso client
const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

logger.info('Starting content indexing...');

// Create table if it doesn't exist
await createTable(client, 'articles', 768);

// Index content
const result = await indexContent({
  client,
  contentPath: './content',
  embeddingOptions: {
    provider: (process.env.EMBEDDING_PROVIDER as 'local' | 'gemini' | 'openai') || 'local',
    dimensions: 768
  },
  onProgress: (current, total, file) => {
    logger.info(`[${current}/${total}] Indexing: ${file}`);
  }
});

logger.info(`Indexing complete!`);
logger.info(`Successfully indexed ${result.success}/${result.total} documents`);

if (result.failed > 0) {
  logger.warn(`Failed to index ${result.failed} documents`);
}
