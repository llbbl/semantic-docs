/**
 * Content Indexing Script
 * Uses libsql-search to index markdown files
 * Falls back to local libSQL if Turso credentials aren't available
 */

import { createClient } from '@libsql/client';
import { createTable, indexContent } from '@logan/libsql-search';
import { logger } from 'logan-logger';
import {
  LOCAL_EMBEDDING_DIMENSIONS,
  SEARCH_TABLE_NAME,
} from '../src/lib/searchConfig';

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
await createTable(client, SEARCH_TABLE_NAME, LOCAL_EMBEDDING_DIMENSIONS);

// Index content
const result = await indexContent({
  client,
  contentPath: './content',
  tableName: SEARCH_TABLE_NAME,
  embeddingOptions: {
    provider: 'local',
    dimensions: LOCAL_EMBEDDING_DIMENSIONS,
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
