/**
 * Post-index pass that persists the frontmatter fields libsql-search parses but
 * does not store.
 *
 * The library folds `description` into the embedding text and discards it, and
 * has no concept of `order`. Both are written back here by slug, after indexing,
 * so pages and the sidebar read them from the database like every other field
 * rather than reaching for ./content at render time.
 */

import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import type { Client } from '@libsql/client';
import matter from 'gray-matter';
import { quoteIdentifier } from '../src/lib/navSchema';

/** Matches the extensions libsql-search indexes, so slugs cannot diverge. */
const CONTENT_EXTENSIONS = ['.md', '.markdown'];

/** The indexer's own default excludes; collecting more would count files it never indexed. */
const EXCLUDED_DIRECTORIES = ['node_modules', '.git', 'dist', 'build'];

export interface NavFrontmatter {
  slug: string;
  order: number | null;
  description: string | null;
}

function parseOrder(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

async function findContentFiles(
  dir: string,
  baseDir: string,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      if (EXCLUDED_DIRECTORIES.includes(entry.name)) continue;
      files.push(...(await findContentFiles(fullPath, baseDir)));
    } else if (CONTENT_EXTENSIONS.includes(extname(entry.name))) {
      files.push(relative(baseDir, fullPath));
    }
  }

  return files;
}

/**
 * Read `order` and `description` from every content file, keyed by the same
 * slug libsql-search derives: the relative path minus its extension.
 */
export async function collectNavFrontmatter(
  contentPath: string,
): Promise<NavFrontmatter[]> {
  // Sorted for the same reason the indexer sorts: when two files claim one
  // slug, the winner must not depend on directory read order.
  const relativePaths = (await findContentFiles(contentPath, contentPath)).sort(
    (a, b) => a.localeCompare(b, 'en'),
  );
  const records: NavFrontmatter[] = [];

  for (const relativePath of relativePaths) {
    const raw = await readFile(join(contentPath, relativePath), 'utf8');
    const { data } = matter(raw);

    records.push({
      slug: relativePath.replace(/\.(md|markdown)$/, '').replaceAll('\\', '/'),
      order: parseOrder(data.order),
      description: parseDescription(data.description),
    });
  }

  return records;
}

/**
 * Write the collected fields onto the indexed rows. Only sets values: the
 * indexer clears and reinserts the whole table on every run, so a field removed
 * from frontmatter is already back to NULL by the time this runs.
 */
export async function applyNavFrontmatter(
  client: Client,
  tableName: string,
  records: readonly NavFrontmatter[],
): Promise<number> {
  if (records.length === 0) return 0;

  const quotedTableName = quoteIdentifier(tableName);

  const results = await client.batch(
    records.map((record) => ({
      sql: `UPDATE ${quotedTableName} SET sort_order = ?, description = ? WHERE slug = ?`,
      args: [record.order, record.description, record.slug],
    })),
    'write',
  );

  // Rows matched, not files read. A slug derived differently here than by the
  // indexer updates nothing, and this count is the only signal that happened.
  return results.reduce((total, result) => total + result.rowsAffected, 0);
}
