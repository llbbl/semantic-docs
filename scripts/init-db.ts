/**
 * Database Schema Initialization Script
 * Sets up the database with vector search support
 * Falls back to local libSQL if Turso credentials aren't available
 */

import { createClient } from '@libsql/client';
import { createTable } from '@logan/libsql-search';
import { logger } from 'logan-logger';
import {
  EMBEDDING_DIMENSIONS,
  SEARCH_FTS_TABLE_NAME,
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

logger.info('Initializing database schema...');

try {
  await createTable(client, SEARCH_TABLE_NAME, EMBEDDING_DIMENSIONS);

  logger.info(
    `Created ${SEARCH_TABLE_NAME} with ${EMBEDDING_DIMENSIONS}-dimension embeddings`,
  );

  // Keyword half of hybrid search. Kept as its own table rather than an
  // external-content one: the indexer clears and repopulates the articles
  // table wholesale, and a standalone index is rebuilt from it in one step
  // without depending on trigger support.
  // slug is carried UNINDEXED and joined on instead of rowid: the indexer
  // clears and reinserts the articles table, and with AUTOINCREMENT every row
  // gets a new id, so rowids captured here would join to nothing after the
  // next reindex.
  await client.execute(
    `CREATE VIRTUAL TABLE IF NOT EXISTS "${SEARCH_FTS_TABLE_NAME}" USING fts5(slug UNINDEXED, title, content, tags)`,
  );

  logger.info(`Created ${SEARCH_FTS_TABLE_NAME} keyword index`);

  // Verify table exists
  const result = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    args: [SEARCH_TABLE_NAME],
  });

  if (result.rows.length > 0) {
    logger.info('Database schema initialized successfully!');
  } else {
    logger.error('Table creation verification failed');
    process.exit(1);
  }
} catch (error) {
  logger.error('Database initialization failed:', error);
  process.exit(1);
}
