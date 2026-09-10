/**
 * @vitest-environment node
 */
import { type Client, createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureNavColumns, quoteIdentifier } from '@/lib/navSchema';

const TABLE = 'articles_test';

// The pre-migration shape libsql-search creates, so the upgrade path is
// exercised against the schema a deployment actually has on disk.
const LEGACY_SCHEMA = `
  CREATE TABLE "${TABLE}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    folder TEXT NOT NULL DEFAULT 'root',
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

let client: Client;

async function columnNames(table: string): Promise<string[]> {
  const result = await client.execute({
    sql: 'SELECT name FROM pragma_table_info(?)',
    args: [table],
  });
  return result.rows.map((row) => String(row.name));
}

beforeEach(() => {
  client = createClient({ url: ':memory:' });
});

afterEach(() => {
  client.close();
});

describe('quoteIdentifier', () => {
  it('wraps a plain identifier', () => {
    expect(quoteIdentifier('articles')).toBe('"articles"');
  });

  it('doubles embedded quotes so the identifier cannot be escaped', () => {
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
  });

  it('rejects an empty identifier', () => {
    expect(() => quoteIdentifier('')).toThrow(/must not be empty/);
  });

  it('rejects an identifier containing a null byte', () => {
    expect(() => quoteIdentifier('a\0b')).toThrow(/Invalid SQL identifier/);
  });
});

describe('ensureNavColumns', () => {
  it('adds both columns to a table created before they existed', async () => {
    await client.execute(LEGACY_SCHEMA);

    const added = await ensureNavColumns(client, TABLE);

    expect(added).toEqual(['sort_order', 'description']);
    expect(await columnNames(TABLE)).toEqual(
      expect.arrayContaining(['sort_order', 'description']),
    );
  });

  it('preserves existing rows across the migration', async () => {
    await client.execute(LEGACY_SCHEMA);
    await client.execute({
      sql: `INSERT INTO "${TABLE}" (slug, title, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: ['a', 'A', 'body', '2026-01-01', '2026-01-01'],
    });

    await ensureNavColumns(client, TABLE);

    const rows = await client.execute(`SELECT * FROM "${TABLE}"`);
    expect(rows.rows[0].title).toBe('A');
    expect(rows.rows[0].sort_order).toBeNull();
    expect(rows.rows[0].description).toBeNull();
  });

  it('is idempotent, so repeated db:init runs are safe', async () => {
    await client.execute(LEGACY_SCHEMA);
    await ensureNavColumns(client, TABLE);

    await expect(ensureNavColumns(client, TABLE)).resolves.toEqual([]);
  });

  it('adds only the missing column when one is already present', async () => {
    await client.execute(LEGACY_SCHEMA);
    await client.execute(`ALTER TABLE "${TABLE}" ADD COLUMN description TEXT`);

    await expect(ensureNavColumns(client, TABLE)).resolves.toEqual([
      'sort_order',
    ]);
  });

  it('throws rather than silently skipping when the table is absent', async () => {
    await expect(ensureNavColumns(client, 'no_such_table')).rejects.toThrow(
      /does not exist/,
    );
  });
});
