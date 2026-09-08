/**
 * Reciprocal rank fusion for combining ranked retrieval lists.
 */

import { RRF_K } from './searchConfig';

export interface Ranked {
  id: number;
}

/**
 * Merge ranked lists by weighted reciprocal rank fusion: each list contributes
 * weight / (k + rank) to a document's score.
 *
 * Rank position is all that carries over, deliberately. bm25 scores and vector
 * distances are on unrelated scales, and normalizing them against each other
 * requires assumptions about their distributions that do not hold across
 * corpora.
 *
 * `weights` must be distinct per list. Equal weights make a rank-1 hit in one
 * list score identically to a rank-1 hit in another, and resolving that by
 * argument order silently hands every disagreement to whichever list was passed
 * first — which decides the top result for conversational queries, not just the
 * exact-match ones the keyword retriever exists to serve.
 */
export function reciprocalRankFusion<T extends Ranked>(
  lists: T[][],
  limit: number,
  weights: number[],
  k: number = RRF_K,
): T[] {
  interface Merged {
    item: T;
    score: number;
  }

  const merged = new Map<number, Merged>();

  lists.forEach((list, listIndex) => {
    const weight = weights[listIndex] ?? 1;

    list.forEach((item, index) => {
      const contribution = weight / (k + index + 1);
      const existing = merged.get(item.id);

      if (existing) {
        existing.score += contribution;
      } else {
        // First sighting keeps the object, so the earlier list's row survives.
        merged.set(item.id, { item, score: contribution });
      }
    });
  });

  return [...merged.values()]
    .sort((a, b) =>
      // Distinct weights make an exact tie essentially unreachable; id only
      // keeps the order stable if one occurs.
      b.score === a.score ? a.item.id - b.item.id : b.score - a.score,
    )
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.item);
}
