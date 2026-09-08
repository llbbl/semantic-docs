import type { Client } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import { buildMatchExpression, keywordSearch } from './keywordSearch';

function clientReturning(rows: unknown[]): Client {
  return { execute: vi.fn().mockResolvedValue({ rows }) } as unknown as Client;
}

describe('buildMatchExpression', () => {
  it('should quote a single term as a phrase', () => {
    expect(buildMatchExpression('deploy')).toBe('"deploy"');
  });

  it('should OR multiple terms', () => {
    expect(buildMatchExpression('how to deploy')).toBe(
      '"how" OR "to" OR "deploy"',
    );
  });

  it('should keep an identifier intact as one phrase', () => {
    expect(buildMatchExpression('TURSO_DB_URL')).toBe('"TURSO_DB_URL"');
  });

  it('should neutralize FTS5 operators by quoting them', () => {
    expect(buildMatchExpression('deploy AND build')).toBe(
      '"deploy" OR "AND" OR "build"',
    );
    expect(buildMatchExpression('NOT foo')).toBe('"NOT" OR "foo"');
  });

  it.each([
    ['unbalanced "quote', '"unbalanced" OR "quote"'],
    ['wildcard*', '"wildcard*"'],
    ['column:filter', '"column:filter"'],
    ['paren(s)', '"paren(s)"'],
    ['^caret', '"^caret"'],
  ])('should survive the special input %s', (input, expected) => {
    expect(buildMatchExpression(input)).toBe(expected);
  });

  it('should collapse extra whitespace', () => {
    expect(buildMatchExpression('  a   b  ')).toBe('"a" OR "b"');
  });

  it('should return an empty expression for whitespace only', () => {
    expect(buildMatchExpression('   ')).toBe('');
    expect(buildMatchExpression('')).toBe('');
  });

  it('should return an empty expression when input is only quotes', () => {
    expect(buildMatchExpression('""')).toBe('');
  });
});

describe('keywordSearch', () => {
  it('should skip the query entirely for an empty expression', async () => {
    const client = clientReturning([]);

    expect(await keywordSearch(client, '   ', 10)).toEqual([]);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it('should map rows into keyword results', async () => {
    const client = clientReturning([
      {
        id: 7,
        slug: 'deploy',
        title: 'Deploying',
        content: 'body',
        folder: 'docs',
        tags: '["ops"]',
      },
    ]);

    expect(await keywordSearch(client, 'deploy', 10)).toEqual([
      {
        id: 7,
        slug: 'deploy',
        title: 'Deploying',
        content: 'body',
        folder: 'docs',
        tags: ['ops'],
        distance: null,
      },
    ]);
  });

  it('should tolerate malformed and missing tags', async () => {
    const client = clientReturning([
      {
        id: 1,
        slug: 's',
        title: 't',
        content: 'c',
        folder: 'f',
        tags: 'not json',
      },
      { id: 2, slug: 's2', title: 't', content: null, folder: 'f', tags: null },
      { id: 3, slug: 's3', title: 't', content: 'c', folder: 'f', tags: '{}' },
    ]);

    const results = await keywordSearch(client, 'x', 10);

    expect(results[0].tags).toEqual([]);
    expect(results[1].tags).toEqual([]);
    expect(results[1].content).toBe('');
    expect(results[2].tags).toEqual([]);
  });

  it('should degrade to an empty list when the index is missing', async () => {
    const client = {
      execute: vi.fn().mockRejectedValue(new Error('no such table')),
    } as unknown as Client;

    // Vector-only results are far better than no search at all.
    expect(await keywordSearch(client, 'deploy', 10)).toEqual([]);
  });

  it('should join on slug so the index survives a reindex', async () => {
    const client = clientReturning([]);

    await keywordSearch(client, 'deploy', 10);

    const { sql } = vi.mocked(client.execute).mock.calls[0][0] as unknown as {
      sql: string;
    };
    // Article ids are AUTOINCREMENT and change on every reindex, so a rowid
    // join would silently match nothing after the next `pnpm index`.
    expect(sql).toContain('a.slug = m.matched_slug');
    expect(sql).not.toContain('a.id = m.rid');
  });

  it('should pass the match expression and limit as bound arguments', async () => {
    const client = clientReturning([]);

    await keywordSearch(client, 'deploy now', 25);

    expect(client.execute).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['"deploy" OR "now"', 25] }),
    );
  });
});
