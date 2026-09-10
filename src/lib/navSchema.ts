/**
 * Navigation columns layered onto the libsql-search articles schema.
 *
 * libsql-search owns the table and stores neither ordering nor description, so
 * this project adds both. `createTable` uses CREATE TABLE IF NOT EXISTS, which
 * is a no-op against an existing table, so upgrading an already-indexed
 * deployment needs an explicit ALTER.
 */

import type { Client } from '@libsql/client';

/** Column added for frontmatter `order`; `order` itself is a SQL keyword. */
export const NAV_ORDER_COLUMN = 'sort_order';

/** Column added for frontmatter `description`. */
export const NAV_DESCRIPTION_COLUMN = 'description';

const NAV_COLUMNS: ReadonlyArray<{ name: string; type: string }> = [
  { name: NAV_ORDER_COLUMN, type: 'INTEGER' },
  { name: NAV_DESCRIPTION_COLUMN, type: 'TEXT' },
];

/**
 * Quote a table name for statements where SQLite cannot bind an identifier.
 * Embedded double quotes are doubled per SQLite's own escaping rule.
 */
export function quoteIdentifier(name: string): string {
  if (name.length === 0) {
    throw new Error('SQL identifier must not be empty');
  }
  if (name.includes('\0')) {
    throw new Error(`Invalid SQL identifier: ${JSON.stringify(name)}`);
  }
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Add any missing navigation columns to an existing table. Returns the columns
 * actually added, so callers can report a migration rather than a no-op run.
 */
export async function ensureNavColumns(
  client: Client,
  tableName: string,
): Promise<string[]> {
  const quotedTableName = quoteIdentifier(tableName);

  const info = await client.execute({
    sql: 'SELECT name FROM pragma_table_info(?)',
    args: [tableName],
  });

  // pragma_table_info yields no rows for a table that does not exist. Both
  // callers create the table first, so an empty result means something else
  // went wrong and must not be mistaken for "no columns missing".
  if (info.rows.length === 0) {
    throw new Error(
      `Cannot add navigation columns: table ${tableName} does not exist`,
    );
  }

  const existing = new Set(info.rows.map((row) => String(row.name)));
  const added: string[] = [];

  for (const column of NAV_COLUMNS) {
    if (existing.has(column.name)) continue;
    await client.execute(
      `ALTER TABLE ${quotedTableName} ADD COLUMN ${column.name} ${column.type}`,
    );
    added.push(column.name);
  }

  return added;
}
