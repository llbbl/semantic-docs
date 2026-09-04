/**
 * Content Indexing Script
 * Uses libsql-search to index markdown files
 * Falls back to local libSQL if Turso credentials aren't available
 */

import { createClient } from '@libsql/client';
import { createTable, indexContent } from '@logan/libsql-search';
import { logger } from 'logan-logger';
import { env } from '../src/lib/env';
import {
  EMBEDDING_DIMENSIONS,
  getEmbeddingOptions,
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

// Checked before any database work so missing credentials fail immediately
// rather than after the table has been created.
if (!env.hasCloudflareCredentials) {
  logger.error(
    'Workers AI credentials are required to index content. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (see .env.example).',
  );
  process.exit(1);
}

const embeddingOptions = getEmbeddingOptions();

process.exitCode = await runContentIndexing(
  {
    createTable: () =>
      createTable(client, SEARCH_TABLE_NAME, EMBEDDING_DIMENSIONS),
    indexContent: (onProgress) =>
      indexContent({
        client,
        contentPath: './content',
        tableName: SEARCH_TABLE_NAME,
        embeddingOptions,
        onProgress,
      }),
  },
  logger,
);
