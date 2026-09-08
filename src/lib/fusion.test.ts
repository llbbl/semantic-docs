import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './fusion';
import { FUSION_WEIGHTS } from './searchConfig';

const doc = (id: number, label = '') => ({ id, label });

/** The production pairing: keyword list first, weighted below vector. */
const W = [FUSION_WEIGHTS.keyword, FUSION_WEIGHTS.vector];

describe('reciprocalRankFusion', () => {
  it('should return an empty list when given no lists', () => {
    expect(reciprocalRankFusion([], 10, W)).toEqual([]);
  });

  it('should pass a single list through in order', () => {
    const list = [doc(1), doc(2), doc(3)];
    expect(reciprocalRankFusion([list], 10, [1]).map((d) => d.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it('should rank a document found by both retrievers above one found by either', () => {
    const keyword = [doc(1), doc(2)];
    const vector = [doc(3), doc(1)];

    expect(reciprocalRankFusion([keyword, vector], 3, W)[0].id).toBe(1);
  });

  it('should respect the limit', () => {
    const list = [doc(1), doc(2), doc(3), doc(4)];
    expect(reciprocalRankFusion([list], 2, [1])).toHaveLength(2);
  });

  it('should treat a zero limit as an empty result', () => {
    expect(reciprocalRankFusion([[doc(1)]], 0, [1])).toEqual([]);
  });

  it('should not return duplicates when a document appears in both lists', () => {
    expect(reciprocalRankFusion([[doc(1)], [doc(1)]], 10, W)).toHaveLength(1);
  });

  it('should keep the object from the earlier list on a duplicate', () => {
    const fused = reciprocalRankFusion(
      [[doc(1, 'keyword')], [doc(1, 'vector')]],
      10,
      W,
    );
    expect(fused[0].label).toBe('keyword');
  });

  it('should give the top slot to the vector hit when each retriever ranks a different document first', () => {
    // Previously an exact tie resolved by argument order, which handed every
    // disagreement to bm25 — including on conversational queries.
    const keyword = [doc(9)];
    const vector = [doc(4)];

    expect(
      reciprocalRankFusion([keyword, vector], 10, W).map((d) => d.id),
    ).toEqual([4, 9]);
  });

  it('should let a keyword hit win on agreement rather than on list order', () => {
    // Ranked first by bm25 and third by the embedding still beats a document
    // only the embedding liked: agreement outweighs the weight difference.
    const keyword = [doc(42)];
    const vector = [doc(1), doc(2), doc(42)];

    expect(reciprocalRankFusion([keyword, vector], 5, W)[0].id).toBe(42);
  });

  it('should not let weights alone override a large rank gap', () => {
    const keyword = [doc(7)];
    const vector = [doc(1), doc(2), doc(3), doc(4), doc(5), doc(7)];

    const fused = reciprocalRankFusion([keyword, vector], 6, W);
    expect(fused[0].id).toBe(7);
    expect(fused[1].id).toBe(1);
  });

  it('should default a missing weight to 1', () => {
    const fused = reciprocalRankFusion([[doc(1)], [doc(2)]], 10, [0.5]);
    expect(fused.map((d) => d.id)).toEqual([2, 1]);
  });

  it('should order deterministically across identical calls', () => {
    const run = () =>
      reciprocalRankFusion([[doc(5), doc(2)], [doc(7)]], 10, W).map(
        (d) => d.id,
      );
    expect(run()).toEqual(run());
  });

  it('should fall back to id on an exact tie', () => {
    // Reachable only with equal weights, which production never passes.
    const fused = reciprocalRankFusion([[doc(9)], [doc(4)]], 10, [1, 1]);
    expect(fused.map((d) => d.id)).toEqual([4, 9]);
  });

  it('should ignore an empty list among populated ones', () => {
    expect(
      reciprocalRankFusion([[], [doc(1), doc(2)]], 10, W).map((d) => d.id),
    ).toEqual([1, 2]);
  });

  it('should apply the k constant when supplied', () => {
    const fused = reciprocalRankFusion([[doc(1), doc(2)]], 10, [1], 1);
    expect(fused.map((d) => d.id)).toEqual([1, 2]);
  });

  it('should keep the configured weights distinct so ties cannot arise', () => {
    expect(FUSION_WEIGHTS.keyword).not.toBe(FUSION_WEIGHTS.vector);
    expect(FUSION_WEIGHTS.vector).toBeGreaterThan(FUSION_WEIGHTS.keyword);
  });
});
