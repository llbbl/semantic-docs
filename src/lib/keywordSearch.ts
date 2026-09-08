/**
 * FTS5 keyword retrieval, run alongside vector search and merged by fusion.
 */

import type { Client } from '@libsql/client';
import { logger } from 'logan-logger';
import { SEARCH_FTS_TABLE_NAME, SEARCH_TABLE_NAME } from './searchConfig';

export interface KeywordResult {
  id: number;
  slug: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  /**
   * Always null. bm25 relevance and vector distance are unrelated scales, so
   * there is nothing meaningful to report here; the field exists so keyword and
   * vector rows share one shape through fusion.
   */
  distance: null;
}

/**
 * Turn raw user input into a safe FTS5 MATCH expression.
 *
 * Every term is emitted as a quoted phrase. That neutralizes the FTS5 query
 * language — a bare `AND`, `*`, `:` or unbalanced quote would otherwise be
 * parsed as syntax and throw — and it is also what makes identifier lookup
 * precise: `"TURSO_DB_URL"` tokenizes to turso/db/url and matches only where
 * those tokens are adjacent, while a bare `turso` still matches everywhere.
 *
 * Terms are OR-ed rather than AND-ed. bm25 already ranks documents containing
 * more of the rarer terms higher, so OR keeps recall without losing precision.
 */
export function buildMatchExpression(query: string): string {
  return (
    query
      .split(/\s+/)
      .map((term) => term.replace(/"/g, ''))
      .filter((term) => term.length > 0)
      // Double quotes are stripped rather than escaped: an FTS5 phrase cannot
      // contain one, and the tokenizer would discard it anyway.
      .map((term) => `"${term}"`)
      .join(' OR ')
  );
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Rank articles by bm25 over the FTS5 index.
 *
 * Returns an empty list rather than throwing when the index is missing, so a
 * deployment that ships this code before re-running `pnpm db:init` degrades to
 * vector-only search instead of losing search altogether. The warning names the
 * fix, because silence here would look like a ranking regression.
 */
export async function keywordSearch(
  client: Client,
  query: string,
  limit: number,
): Promise<KeywordResult[]> {
  const match = buildMatchExpression(query);
  if (!match) return [];

  try {
    // The FTS5 table name cannot be aliased: MATCH and bm25() both require the
    // literal name, so the ranking runs in a subquery that the articles table
    // is then joined onto.
    const result = await client.execute({
      sql: `SELECT a.id, a.slug, a.title, a.content, a.folder, a.tags
            FROM (
              SELECT rowid AS rid, bm25("${SEARCH_FTS_TABLE_NAME}") AS score
              FROM "${SEARCH_FTS_TABLE_NAME}"
              WHERE "${SEARCH_FTS_TABLE_NAME}" MATCH ?
              ORDER BY score
              LIMIT ?
            ) m
            JOIN "${SEARCH_TABLE_NAME}" a ON a.id = m.rid
            ORDER BY m.score`,
      args: [match, limit],
    });

    return result.rows.map((row) => ({
      id: Number(row.id),
      slug: String(row.slug),
      title: String(row.title),
      content: String(row.content ?? ''),
      folder: String(row.folder),
      tags: parseTags(row.tags),
      distance: null,
    }));
  } catch (error) {
    logger.warn(
      `Keyword search unavailable, falling back to vector-only results. Run "pnpm db:init" to create ${SEARCH_FTS_TABLE_NAME}.`,
      error,
    );
    return [];
  }
}
