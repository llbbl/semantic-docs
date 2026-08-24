/**
 * Database Schema Initialization Script
 * Sets up the database with vector search support
 * Falls back to local libSQL if Turso credentials aren't available
 */

import { createClient } from '@libsql/client';
import { createTable } from '@logan/libsql-search';
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

logger.info('Initializing database schema...');

try {
  await createTable(client, SEARCH_TABLE_NAME, LOCAL_EMBEDDING_DIMENSIONS);

  logger.info(
    `Created ${SEARCH_TABLE_NAME} with ${LOCAL_EMBEDDING_DIMENSIONS}-dimension embeddings`,
  );

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
