/**
 * @vitest-environment node
 */
import { type Client, createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getNavArticles } from '@/lib/articles';

const TABLE = 'articles_test';

let client: Client;

async function seed(
  row: Partial<{
    slug: string;
    title: string;
    folder: string | null;
    tags: string | null;
    sort_order: number | null;
    description: string | null;
  }>,
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO "${TABLE}"
          (slug, title, content, folder, tags, sort_order, description, created_at, updated_at)
          VALUES (?, ?, 'body', ?, ?, ?, ?, '2026-01-01', '2026-01-02')`,
    args: [
      row.slug ?? 'slug',
      row.title ?? 'Title',
      row.folder === undefined ? 'docs' : row.folder,
      row.tags === undefined ? '["a"]' : row.tags,
      row.sort_order ?? null,
      row.description ?? null,
    ],
  });
}

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  await client.execute(`
    CREATE TABLE "${TABLE}" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      folder TEXT,
      tags TEXT DEFAULT '[]',
      sort_order INTEGER,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
});

afterEach(() => {
  client.close();
});

describe('getNavArticles', () => {
  it('maps the navigation columns onto the article summary', async () => {
    await seed({
      slug: 'guides/intro',
      title: 'Intro',
      folder: 'guides',
      sort_order: 2,
      description: 'An introduction',
    });

    const [article] = await getNavArticles(client, TABLE);

    expect(article).toMatchObject({
      slug: 'guides/intro',
      title: 'Intro',
      folder: 'guides',
      tags: ['a'],
      order: 2,
      description: 'An introduction',
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    });
    expect(typeof article.id).toBe('number');
  });

  it('reports missing navigation values as null', async () => {
    await seed({ slug: 'bare' });

    const [article] = await getNavArticles(client, TABLE);

    expect(article.order).toBeNull();
    expect(article.description).toBeNull();
  });

  it('treats a blank description as absent so meta tags fall back', async () => {
    await seed({ slug: 'blank', description: '   ' });

    expect((await getNavArticles(client, TABLE))[0].description).toBeNull();
  });

  it('trims a stored description', async () => {
    await seed({ slug: 'padded', description: '  spaced  ' });

    expect((await getNavArticles(client, TABLE))[0].description).toBe('spaced');
  });

  it('keeps order 0 rather than collapsing it to null', async () => {
    await seed({ slug: 'zero', sort_order: 0 });

    expect((await getNavArticles(client, TABLE))[0].order).toBe(0);
  });

  it('preserves a null folder for callers to bucket as root', async () => {
    await seed({ slug: 'top', folder: null });

    expect((await getNavArticles(client, TABLE))[0].folder).toBeNull();
  });

  it('falls back to no tags when the column is unparseable', async () => {
    await seed({ slug: 'broken', tags: 'not json' });

    expect((await getNavArticles(client, TABLE))[0].tags).toEqual([]);
  });

  it('returns every row', async () => {
    await seed({ slug: 'one' });
    await seed({ slug: 'two' });

    expect(await getNavArticles(client, TABLE)).toHaveLength(2);
  });
});
