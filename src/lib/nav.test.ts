import { describe, expect, it } from 'vitest';
import { folderOrder } from '@/config/nav';
import {
  compareArticles,
  compareFolders,
  getArticleNeighbors,
  groupArticlesByFolder,
} from '@/lib/nav';
import type { ArticleNavSummary } from '@/types/article';

function article(
  overrides: Partial<ArticleNavSummary> & { slug: string },
): ArticleNavSummary {
  return {
    id: 1,
    title: overrides.slug,
    folder: 'docs',
    tags: [],
    order: null,
    description: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('compareArticles', () => {
  it('orders by `order` ascending when both declare one', () => {
    const a = article({ slug: 'a', order: 2 });
    const b = article({ slug: 'b', order: 1 });

    expect([a, b].sort(compareArticles).map((x) => x.slug)).toEqual(['b', 'a']);
  });

  it('sorts articles without `order` after those that have one', () => {
    const withOrder = article({ slug: 'zzz', title: 'Zzz', order: 99 });
    const without = article({ slug: 'aaa', title: 'Aaa' });

    expect(
      [without, withOrder].sort(compareArticles).map((x) => x.slug),
    ).toEqual(['zzz', 'aaa']);
  });

  it('falls back to title when neither declares an order', () => {
    const a = article({ slug: 'one', title: 'Beta' });
    const b = article({ slug: 'two', title: 'Alpha' });

    expect([a, b].sort(compareArticles).map((x) => x.title)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('falls back to title when orders are equal', () => {
    const a = article({ slug: 'one', title: 'Beta', order: 5 });
    const b = article({ slug: 'two', title: 'Alpha', order: 5 });

    expect([a, b].sort(compareArticles).map((x) => x.title)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('breaks a title tie on slug so the order is total', () => {
    const a = article({ slug: 'b-slug', title: 'Same' });
    const b = article({ slug: 'a-slug', title: 'Same' });

    expect([a, b].sort(compareArticles).map((x) => x.slug)).toEqual([
      'a-slug',
      'b-slug',
    ]);
    expect(compareArticles(a, a)).toBe(0);
  });

  it('treats order 0 as declared, not absent', () => {
    const zero = article({ slug: 'zero', order: 0 });
    const none = article({ slug: 'none' });

    expect([none, zero].sort(compareArticles).map((x) => x.slug)).toEqual([
      'zero',
      'none',
    ]);
  });
});

describe('compareFolders', () => {
  const order = ['getting-started', 'features'];

  it('orders configured folders by their configured position', () => {
    expect(
      ['features', 'getting-started'].sort((a, b) =>
        compareFolders(a, b, order),
      ),
    ).toEqual(['getting-started', 'features']);
  });

  it('places unconfigured folders after configured ones, alphabetically', () => {
    const folders = ['zebra', 'features', 'apple', 'getting-started'];

    expect(folders.sort((a, b) => compareFolders(a, b, order))).toEqual([
      'getting-started',
      'features',
      'apple',
      'zebra',
    ]);
  });
});

describe('groupArticlesByFolder', () => {
  it('sorts folders and articles, and buckets a null folder as root', () => {
    const articles = [
      article({
        slug: 'g/second',
        folder: 'guides',
        title: 'Second',
        order: 2,
      }),
      article({ slug: 'top', folder: null, title: 'Top' }),
      article({ slug: 'g/first', folder: 'guides', title: 'First', order: 1 }),
    ];

    const groups = groupArticlesByFolder(articles, ['guides']);

    expect(groups.map((group) => group.folder)).toEqual(['guides', 'root']);
    expect(groups[0].articles.map((a) => a.slug)).toEqual([
      'g/first',
      'g/second',
    ]);
  });

  it('does not mutate the caller array', () => {
    const articles = [
      article({ slug: 'b', order: 2 }),
      article({ slug: 'a', order: 1 }),
    ];

    groupArticlesByFolder(articles);

    expect(articles.map((a) => a.slug)).toEqual(['b', 'a']);
  });
});

describe('getArticleNeighbors', () => {
  const articles = [
    article({ slug: 'g/c', folder: 'guides', title: 'C', order: 3 }),
    article({ slug: 'g/a', folder: 'guides', title: 'A', order: 1 }),
    article({ slug: 'g/b', folder: 'guides', title: 'B', order: 2 }),
    article({ slug: 'other/x', folder: 'other', title: 'X' }),
  ];

  it('returns the surrounding siblings in sidebar order', () => {
    const { previous, next } = getArticleNeighbors(articles, 'g/b');

    expect(previous?.slug).toBe('g/a');
    expect(next?.slug).toBe('g/c');
  });

  it('gives the first article no previous', () => {
    expect(getArticleNeighbors(articles, 'g/a')).toMatchObject({
      previous: null,
    });
    expect(getArticleNeighbors(articles, 'g/a').next?.slug).toBe('g/b');
  });

  it('gives the last article no next', () => {
    expect(getArticleNeighbors(articles, 'g/c')).toMatchObject({ next: null });
    expect(getArticleNeighbors(articles, 'g/c').previous?.slug).toBe('g/b');
  });

  it('does not cross folder boundaries', () => {
    expect(getArticleNeighbors(articles, 'other/x')).toEqual({
      previous: null,
      next: null,
    });
  });

  it('returns no neighbours for an unknown slug', () => {
    expect(getArticleNeighbors(articles, 'missing')).toEqual({
      previous: null,
      next: null,
    });
  });
});

describe('shipped folder configuration', () => {
  // The comparator tests supply their own arrays, so nothing else pins the
  // order this site actually renders in.
  it('orders the shipped folders by config, not alphabetically', () => {
    const alphabetical = [...folderOrder].sort((a, b) => a.localeCompare(b));
    const configured = [...folderOrder].sort(compareFolders);

    expect(configured).toEqual(['getting-started', 'features', 'theme']);
    expect(configured).not.toEqual(alphabetical);
  });
});

describe('getArticleNeighbors edge cases', () => {
  it('returns no neighbors for a slug not in the list', () => {
    expect(
      getArticleNeighbors([article({ slug: 'a', folder: 'docs' })], 'missing'),
    ).toEqual({ previous: null, next: null });
  });

  // A null folder means the article sits at the top of ./content, and those
  // are neighbors of each other rather than of any folder's contents.
  it('groups articles with no folder under the root folder', () => {
    const articles = [
      article({ slug: 'one', folder: null, title: 'One', order: 1 }),
      article({ slug: 'two', folder: null, title: 'Two', order: 2 }),
      article({ slug: 'g/x', folder: 'guides', title: 'X', order: 1 }),
    ];

    expect(getArticleNeighbors(articles, 'one')).toMatchObject({
      previous: null,
      next: { slug: 'two' },
    });
    expect(getArticleNeighbors(articles, 'two')).toMatchObject({
      previous: { slug: 'one' },
      next: null,
    });
  });
});

describe('compareArticles ordering direction', () => {
  const ordered = article({ slug: 'o', title: 'O', order: 1 });
  const unordered = article({ slug: 'u', title: 'U', order: null });

  it('sorts an unordered article after an ordered one, either way round', () => {
    expect(compareArticles(unordered, ordered)).toBeGreaterThan(0);
    expect(compareArticles(ordered, unordered)).toBeLessThan(0);
  });
});
