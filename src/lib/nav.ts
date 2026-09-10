/**
 * Sidebar ordering: how articles sort inside a folder, how folders sort
 * against each other, and which articles neighbour a given slug.
 *
 * Pure functions over already-fetched rows, so the sidebar, the article page
 * and the prev/next links all derive their order from one implementation.
 */

import { folderOrder } from '@/config/nav';
import type { ArticleNavSummary, ArticleNeighbors } from '@/types/article';

/** Folder assigned to articles stored at the top level of ./content. */
export const ROOT_FOLDER = 'root';

export interface FolderGroup {
  folder: string;
  articles: ArticleNavSummary[];
}

// Fixed locale rather than the host default, so a build machine's locale cannot
// change the emitted page order.
const COLLATION_LOCALE = 'en';

function compareText(a: string, b: string): number {
  return a.localeCompare(b, COLLATION_LOCALE);
}

/**
 * Order articles by `order` ascending, then title, then slug. An article
 * without `order` sorts after every article that has one; slug is unique in the
 * table, so the comparator is total and the build order is deterministic.
 */
export function compareArticles(
  a: ArticleNavSummary,
  b: ArticleNavSummary,
): number {
  if (a.order !== b.order) {
    if (a.order === null) return 1;
    if (b.order === null) return -1;
    return a.order - b.order;
  }

  const byTitle = compareText(a.title, b.title);
  return byTitle !== 0 ? byTitle : compareText(a.slug, b.slug);
}

/**
 * Order folders by their position in the nav config. Folders absent from it
 * sort after every configured folder, alphabetically, so adding content never
 * requires touching the config.
 */
export function compareFolders(
  a: string,
  b: string,
  order: readonly string[] = folderOrder,
): number {
  const indexA = order.indexOf(a);
  const indexB = order.indexOf(b);

  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return compareText(a, b);
}

/**
 * Group articles into folders, both levels sorted for rendering.
 */
export function groupArticlesByFolder(
  articles: readonly ArticleNavSummary[],
  order: readonly string[] = folderOrder,
): FolderGroup[] {
  const groups = new Map<string, ArticleNavSummary[]>();

  for (const article of articles) {
    const folder = article.folder || ROOT_FOLDER;
    const group = groups.get(folder);
    if (group) {
      group.push(article);
    } else {
      groups.set(folder, [article]);
    }
  }

  return [...groups.entries()]
    .map(([folder, folderArticles]) => ({
      folder,
      articles: folderArticles.sort(compareArticles),
    }))
    .sort((a, b) => compareFolders(a.folder, b.folder, order));
}

/**
 * Neighbours of `slug` within its own folder, in sidebar order. Navigation
 * does not cross folder boundaries, so the first and last article of each
 * folder have no previous and no next respectively.
 */
export function getArticleNeighbors(
  articles: readonly ArticleNavSummary[],
  slug: string,
): ArticleNeighbors {
  const current = articles.find((article) => article.slug === slug);
  if (!current) return { previous: null, next: null };

  const folder = current.folder || ROOT_FOLDER;
  const siblings = articles
    .filter((article) => (article.folder || ROOT_FOLDER) === folder)
    .sort(compareArticles);

  const index = siblings.findIndex((article) => article.slug === slug);

  return {
    previous: index > 0 ? siblings[index - 1] : null,
    next: index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}
