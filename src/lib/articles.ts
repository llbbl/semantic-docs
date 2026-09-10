/**
 * Article reads that need this project's navigation columns.
 *
 * libsql-search's `getAllArticles` selects a fixed column list that cannot
 * include `sort_order` or `description`, so the sidebar and article pages read
 * through here instead. Everything else still goes through the library.
 */

import type { Client, Row } from '@libsql/client';
import { quoteIdentifier } from '@/lib/navSchema';
import type { ArticleNavSummary } from '@/types/article';

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// The client's default intMode throws on an integer too wide for a JS number
// rather than handing back a bigint, and SQLite stores neither NaN nor Infinity,
// so anything that arrives as a number here is already usable.
function parseOrder(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function parseDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toNavArticle(row: Row): ArticleNavSummary {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    folder: row.folder === null ? null : String(row.folder),
    tags: parseTags(row.tags),
    order: parseOrder(row.sort_order),
    description: parseDescription(row.description),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Every article with its navigation fields, unsorted. Callers order the rows
 * through `src/lib/nav.ts` so folder order and article order stay in one place.
 *
 * Throws if the navigation columns are missing, which means the database
 * predates them; run `pnpm db:init` (or `db:init:local`) to add them.
 */
export async function getNavArticles(
  client: Client,
  tableName: string,
): Promise<ArticleNavSummary[]> {
  try {
    const result = await client.execute(
      `SELECT id, slug, title, folder, tags, sort_order, description, created_at, updated_at
       FROM ${quoteIdentifier(tableName)}`,
    );

    return result.rows.map(toNavArticle);
  } catch (error) {
    // The nav columns are the one schema difference from a stock libsql-search
    // table, so a missing column here names a step, not a bug. The person
    // hitting this is mid-upgrade and will not go looking in the docs.
    if (error instanceof Error && /no such column/i.test(error.message)) {
      throw new Error(
        `${tableName} is missing the navigation columns. Run "pnpm db:init" (or "pnpm db:init:local"), then "pnpm index".`,
        { cause: error },
      );
    }
    throw error;
  }
}
