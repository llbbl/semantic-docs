/**
 * Utility functions
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format folder name for display
 * Converts kebab-case to Title Case
 */
export function formatFolderName(folder: string): string {
  if (folder === 'root') return 'Documentation';
  return folder
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

/**
 * Generate slug from title
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Extract headings from HTML content for TOC
 * Handles id attribute in any position within the tag
 */
export function extractHeadings(
  html: string,
): Array<{ id: string; text: string; level: number }> {
  // Match h2-h3 tags with any attributes, capture level and content
  const headingRegex = /<h([2-3])([^>]*)>(.*?)<\/h\1>/gi;
  // Separate regex to extract id from attributes
  const idRegex = /\bid=["']([^"']*)["']/i;
  const headings: Array<{ id: string; text: string; level: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const attributes = match[2];
    const content = match[3];

    // Extract id from attributes (can be anywhere in the tag)
    const idMatch = idRegex.exec(attributes);
    if (idMatch) {
      headings.push({
        level,
        id: idMatch[1],
        text: content.replace(/<[^>]*>/g, '').trim(),
      });
    }
  }

  return headings;
}
