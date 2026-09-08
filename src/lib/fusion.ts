/**
 * Reciprocal rank fusion for combining ranked retrieval lists.
 */

import { RRF_K } from './searchConfig';

export interface Ranked {
  id: number;
}

/**
 * Merge ranked lists by reciprocal rank fusion: each list contributes
 * 1 / (k + rank) to a document's score.
 *
 * Rank position is all that carries over, deliberately. bm25 scores and vector
 * distances are on unrelated scales, and normalizing them against each other
 * requires assumptions about their distributions that do not hold across
 * corpora.
 */
export function reciprocalRankFusion<T extends Ranked>(
  lists: T[][],
  limit: number,
  k: number = RRF_K,
): T[] {
  interface Merged {
    item: T;
    score: number;
    /** List a document was first seen in, used only to break exact ties. */
    listIndex: number;
  }

  const merged = new Map<number, Merged>();

  lists.forEach((list, listIndex) => {
    list.forEach((item, index) => {
      const contribution = 1 / (k + index + 1);
      const existing = merged.get(item.id);

      if (existing) {
        existing.score += contribution;
      } else {
        // First sighting keeps the object, so the earlier list's row survives.
        merged.set(item.id, { item, score: contribution, listIndex });
      }
    });
  });

  return [...merged.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Two documents each ranked first by a different retriever tie exactly.
      // The earlier list wins, which is why callers pass the list whose top hit
      // should break ties first; id keeps the rest deterministic.
      if (a.listIndex !== b.listIndex) return a.listIndex - b.listIndex;
      return a.item.id - b.item.id;
    })
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.item);
}
