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
  SEARCH_FTS_TABLE_NAME,
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

/**
 * Rebuild the keyword index from the rows just written. A full rebuild rather
 * than an incremental update, because the indexer clears the articles table on
 * every run; this keeps the two halves of hybrid search in step without
 * assuming anything about how the rows got there.
 */
async function rebuildKeywordIndex(): Promise<void> {
  await client.execute(
    `CREATE VIRTUAL TABLE IF NOT EXISTS "${SEARCH_FTS_TABLE_NAME}" USING fts5(title, content, tags)`,
  );
  await client.execute(`DELETE FROM "${SEARCH_FTS_TABLE_NAME}"`);
  await client.execute(
    `INSERT INTO "${SEARCH_FTS_TABLE_NAME}"(rowid, title, content, tags)
     SELECT id, title, content, tags FROM "${SEARCH_TABLE_NAME}"`,
  );
}

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
    rebuildKeywordIndex,
  },
  logger,
);
