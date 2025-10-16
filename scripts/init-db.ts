/**
 * Database Schema Initialization Script
 * Sets up the database with vector search support
 * Falls back to local libSQL if Turso credentials aren't available
 */

import { createClient } from '@libsql/client';
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

logger.info('Initializing database schema...');

try {
  // Create articles table with vector search support
  await client.execute(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT 'root',
      tags TEXT DEFAULT '[]',
      embedding F32_BLOB(768),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  logger.info('Articles table created');

  // Create vector index for fast semantic search
  await client.execute(`
    CREATE INDEX IF NOT EXISTS articles_embedding_idx
    ON articles(libsql_vector_idx(embedding))
  `);

  logger.info('Vector search index created');

  // Create additional indexes for common queries
  await client.execute(`
    CREATE INDEX IF NOT EXISTS articles_folder_idx ON articles(folder)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS articles_slug_idx ON articles(slug)
  `);

  logger.info('Additional indexes created');

  // Verify table exists
  const result = await client.execute(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='articles'
  `);

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
