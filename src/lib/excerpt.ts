/**
 * Builds short plain-text excerpts from article markdown for search results.
 */

const DEFAULT_EXCERPT_LENGTH = 160;

/** Terms shorter than this are too noisy to center an excerpt on. */
const MIN_TERM_LENGTH = 2;

/**
 * Strips markdown syntax down to readable prose.
 *
 * Emphasis markers are matched as pairs rather than deleted character by
 * character, so identifiers keep their underscores: a blanket `[_*~]` strip
 * turns `vector_distance_cos` into `vectordistancecos`.
 */
export function toPlainText(markdown: string): string {
  return (
    markdown
      // Fenced code carries no useful prose and its punctuation reads badly.
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/~~~[\s\S]*?~~~/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/^\s{0,3}\d+[.)]\s+/gm, '')
      .replace(/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/gm, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      // Underscore emphasis only at word boundaries, never mid-identifier.
      .replace(/(^|[\s(])__([^_]+)__(?=[\s).,;:!?]|$)/g, '$1$2')
      .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, '$1$2')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Index of the earliest query term in the text, or -1 when none appear. */
function findFirstTermIndex(text: string, query: string): number {
  const haystack = text.toLowerCase();
  let earliest = -1;

  for (const term of query.toLowerCase().split(/\s+/)) {
    if (term.length < MIN_TERM_LENGTH) continue;
    const index = haystack.indexOf(term);
    if (index !== -1 && (earliest === -1 || index < earliest)) {
      earliest = index;
    }
  }

  return earliest;
}

/**
 * A plain-text window of `content`, centered on the first matching query term
 * and falling back to the opening prose. Semantic search can match an article
 * whose text never contains the query, which is why the fallback exists.
 */
export function buildExcerpt(
  content: string,
  query: string,
  maxLength: number = DEFAULT_EXCERPT_LENGTH,
): string {
  const text = toPlainText(content ?? '');
  if (text.length <= maxLength) return text;

  const match = findFirstTermIndex(text, query ?? '');
  // Sit the match about a third in, so there is leading context but the term
  // is still visible without reading to the end.
  let start = match === -1 ? 0 : Math.max(0, match - Math.floor(maxLength / 3));

  if (start > 0) {
    // Advance to a word boundary so the excerpt does not open mid-word.
    const nextSpace = text.indexOf(' ', start);
    if (nextSpace !== -1 && nextSpace - start <= 20) start = nextSpace + 1;
  }

  let slice = text.slice(start, start + maxLength);
  const reachedEnd = start + maxLength >= text.length;

  if (!reachedEnd) {
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.6) slice = slice.slice(0, lastSpace);
  }

  slice = slice.trim();

  return `${start > 0 ? '…' : ''}${slice}${start + slice.length < text.length ? '…' : ''}`;
}
