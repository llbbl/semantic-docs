/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Client, createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyNavFrontmatter, collectNavFrontmatter } from './nav-frontmatter';

const TABLE = 'articles_test';

let contentDir: string;
let client: Client;

async function writeContent(
  relativePath: string,
  frontmatter: string,
): Promise<void> {
  const fullPath = join(contentDir, relativePath);
  await mkdir(join(fullPath, '..'), { recursive: true });
  await writeFile(fullPath, `---\n${frontmatter}\n---\n\nBody text.\n`, 'utf8');
}

function bySlug(records: Awaited<ReturnType<typeof collectNavFrontmatter>>) {
  return Object.fromEntries(records.map((record) => [record.slug, record]));
}

beforeEach(async () => {
  contentDir = await mkdtemp(join(tmpdir(), 'nav-frontmatter-'));
  client = createClient({ url: ':memory:' });
  await client.execute(`
    CREATE TABLE "${TABLE}" (
      slug TEXT UNIQUE NOT NULL,
      sort_order INTEGER,
      description TEXT
    )
  `);
});

afterEach(async () => {
  client.close();
  await rm(contentDir, { recursive: true, force: true });
});

describe('collectNavFrontmatter', () => {
  it('derives the slug from the path the way libsql-search does', async () => {
    await writeContent('guides/intro.md', 'title: Intro');
    await writeContent('top.markdown', 'title: Top');

    const slugs = (await collectNavFrontmatter(contentDir))
      .map((record) => record.slug)
      .sort();

    expect(slugs).toEqual(['guides/intro', 'top']);
  });

  it('reads order and description', async () => {
    await writeContent(
      'guides/intro.md',
      'title: Intro\norder: 3\ndescription: The opening chapter',
    );

    expect(
      bySlug(await collectNavFrontmatter(contentDir))['guides/intro'],
    ).toEqual({
      slug: 'guides/intro',
      order: 3,
      description: 'The opening chapter',
    });
  });

  it('accepts a quoted numeric order', async () => {
    await writeContent('a.md', "order: '4'");

    expect((await collectNavFrontmatter(contentDir))[0].order).toBe(4);
  });

  it('ignores a non-numeric order rather than failing the run', async () => {
    await writeContent('a.md', 'order: first');

    expect((await collectNavFrontmatter(contentDir))[0].order).toBeNull();
  });

  it('ignores a non-string description', async () => {
    await writeContent('a.md', 'description:\n  - a list');

    expect((await collectNavFrontmatter(contentDir))[0].description).toBeNull();
  });

  it('handles a description containing a colon', async () => {
    await writeContent('a.md', 'description: "Search: how it works"');

    expect((await collectNavFrontmatter(contentDir))[0].description).toBe(
      'Search: how it works',
    );
  });

  it('yields nulls for a file with no frontmatter', async () => {
    await writeFile(join(contentDir, 'plain.md'), '# Plain\n', 'utf8');

    expect(await collectNavFrontmatter(contentDir)).toEqual([
      { slug: 'plain', order: null, description: null },
    ]);
  });

  it('skips non-markdown files and dot directories', async () => {
    await writeContent('a.md', 'order: 1');
    await writeFile(join(contentDir, 'notes.txt'), 'ignored', 'utf8');
    await mkdir(join(contentDir, '.hidden'), { recursive: true });
    await writeFile(join(contentDir, '.hidden', 'b.md'), '# Hidden\n', 'utf8');

    expect(
      (await collectNavFrontmatter(contentDir)).map((r) => r.slug),
    ).toEqual(['a']);
  });
});

describe('applyNavFrontmatter', () => {
  beforeEach(async () => {
    await client.batch(
      [
        `INSERT INTO "${TABLE}" (slug) VALUES ('guides/intro')`,
        `INSERT INTO "${TABLE}" (slug) VALUES ('other')`,
      ],
      'write',
    );
  });

  it('writes the fields onto the matching row only', async () => {
    const updated = await applyNavFrontmatter(client, TABLE, [
      { slug: 'guides/intro', order: 2, description: 'Opening' },
    ]);

    expect(updated).toBe(1);

    const rows = await client.execute(
      `SELECT slug, sort_order, description FROM "${TABLE}" ORDER BY slug`,
    );
    expect(
      rows.rows.map((row) => [row.slug, row.sort_order, row.description]),
    ).toEqual([
      ['guides/intro', 2, 'Opening'],
      ['other', null, null],
    ]);
  });

  it('counts rows matched, not records supplied', async () => {
    await expect(
      applyNavFrontmatter(client, TABLE, [
        { slug: 'never-indexed', order: 1, description: 'x' },
      ]),
    ).resolves.toBe(0);
  });

  it('is a no-op for an empty content directory', async () => {
    await expect(applyNavFrontmatter(client, TABLE, [])).resolves.toBe(0);
  });

  it('stores a slug containing SQL metacharacters as a value, not syntax', async () => {
    await client.execute(
      `INSERT INTO "${TABLE}" (slug) VALUES ('a''); DROP TABLE "${TABLE}"; --')`,
    );

    await applyNavFrontmatter(client, TABLE, [
      {
        slug: `a'); DROP TABLE "${TABLE}"; --`,
        order: 7,
        description: null,
      },
    ]);

    const rows = await client.execute(
      `SELECT sort_order FROM "${TABLE}" WHERE sort_order = 7`,
    );
    expect(rows.rows).toHaveLength(1);
  });
});
