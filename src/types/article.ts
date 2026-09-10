/**
 * Article type definitions
 * Shared types for article data across the application
 */

/**
 * Full article with all fields including content
 */
export interface Article {
  id: number;
  slug: string;
  title: string;
  folder: string | null;
  tags: string[];
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Article summary without content (for lists/sidebar)
 */
export interface ArticleSummary {
  id: number;
  slug: string;
  title: string;
  folder: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Article summary carrying the navigation fields this project persists on top
 * of the libsql-search schema. `order` is frontmatter `order`, stored in the
 * `sort_order` column because `order` is a SQL keyword.
 */
export interface ArticleNavSummary extends ArticleSummary {
  /** null when the article declares no `order`; sorts after those that do. */
  order: number | null;
  /** Frontmatter `description`, used for meta tags. null when absent. */
  description: string | null;
}

/**
 * Neighbouring articles within a folder, in sidebar order.
 */
export interface ArticleNeighbors {
  previous: ArticleNavSummary | null;
  next: ArticleNavSummary | null;
}

/**
 * Search result with distance score
 */
export interface ArticleSearchResult {
  id: number;
  title: string;
  slug: string;
  folder: string;
  tags: string[];
  distance: number | null;
}
