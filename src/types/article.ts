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
 * Search result with distance score
 */
export interface ArticleSearchResult {
  id: number;
  title: string;
  slug: string;
  folder: string;
  tags: string[];
  distance: number;
}
