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
import { runContentIndexing } from './index-content-runner';

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

process.exitCode = await runContentIndexing(
  {
    createTable: () =>
      createTable(client, SEARCH_TABLE_NAME, LOCAL_EMBEDDING_DIMENSIONS),
    indexContent: (onProgress) =>
      indexContent({
        client,
        contentPath: './content',
        tableName: SEARCH_TABLE_NAME,
        embeddingOptions: {
          provider: 'local',
          dimensions: LOCAL_EMBEDDING_DIMENSIONS,
        },
        onProgress,
      }),
  },
  logger,
);
