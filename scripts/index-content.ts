/**
 * Content Indexing Script
 * Uses libsql-search to index markdown files
 * Falls back to local libSQL if Turso credentials aren't available
 */

import { createClient } from '@libsql/client';
import { createTable, indexContent } from '@logan/libsql-search';
import { logger } from 'logan-logger';
import { env } from '../src/lib/env';
import { ensureNavColumns } from '../src/lib/navSchema';
import {
  EMBEDDING_DIMENSIONS,
  getEmbeddingOptions,
  SEARCH_FTS_TABLE_NAME,
  SEARCH_TABLE_NAME,
} from '../src/lib/searchConfig';
import { runContentIndexing } from './index-content-runner';
import { applyNavFrontmatter, collectNavFrontmatter } from './nav-frontmatter';

const CONTENT_PATH = './content';

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
if (!env.hasEmbeddingProvider) {
  logger.error(
    'No embedding provider configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or OFFLINE_EMBEDDINGS_BASE_URL for a credential-free local service (see .env.example).',
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
    `CREATE VIRTUAL TABLE IF NOT EXISTS "${SEARCH_FTS_TABLE_NAME}" USING fts5(slug UNINDEXED, title, content, tags)`,
  );

  // One transaction: a clear that commits without its refill would leave the
  // keyword index empty, and an empty index returns rows cleanly rather than
  // erroring, so nothing downstream would notice.
  await client.batch(
    [
      `DELETE FROM "${SEARCH_FTS_TABLE_NAME}"`,
      `INSERT INTO "${SEARCH_FTS_TABLE_NAME}"(slug, title, content, tags)
       SELECT slug, title, content, tags FROM "${SEARCH_TABLE_NAME}"`,
    ],
    'write',
  );
}

process.exitCode = await runContentIndexing(
  {
    // Indexing runs against databases created before the navigation columns
    // existed, so it migrates rather than assuming db:init was rerun.
    createTable: async () => {
      await createTable(client, SEARCH_TABLE_NAME, EMBEDDING_DIMENSIONS);
      await ensureNavColumns(client, SEARCH_TABLE_NAME);
    },
    indexContent: (onProgress) =>
      indexContent({
        client,
        contentPath: CONTENT_PATH,
        tableName: SEARCH_TABLE_NAME,
        embeddingOptions,
        onProgress,
      }),
    applyNavFrontmatter: async () => {
      const records = await collectNavFrontmatter(CONTENT_PATH);
      const updated = await applyNavFrontmatter(
        client,
        SEARCH_TABLE_NAME,
        records,
      );

      // A shortfall means a file on disk has no indexed row under the slug this
      // pass derived, so its ordering and description are silently missing.
      if (updated < records.length) {
        logger.warn(
          `Navigation frontmatter matched ${updated} of ${records.length} content files; the rest are not in the index under the expected slug`,
        );
      }

      return updated;
    },
    rebuildKeywordIndex,
  },
  logger,
);
