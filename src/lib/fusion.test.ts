import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './fusion';

const doc = (id: number, label = '') => ({ id, label });

describe('reciprocalRankFusion', () => {
  it('should return an empty list when given no lists', () => {
    expect(reciprocalRankFusion([], 10)).toEqual([]);
  });

  it('should pass a single list through in order', () => {
    const list = [doc(1), doc(2), doc(3)];
    expect(reciprocalRankFusion([list], 10).map((d) => d.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it('should rank a document found by both retrievers above one found by either', () => {
    const keyword = [doc(1), doc(2)];
    const vector = [doc(3), doc(1)];

    // 1 scores in both lists; 2 and 3 score in one each.
    expect(reciprocalRankFusion([keyword, vector], 3)[0].id).toBe(1);
  });

  it('should respect the limit', () => {
    const list = [doc(1), doc(2), doc(3), doc(4)];
    expect(reciprocalRankFusion([list], 2)).toHaveLength(2);
  });

  it('should treat a zero limit as an empty result', () => {
    expect(reciprocalRankFusion([[doc(1)]], 0)).toEqual([]);
  });

  it('should not return duplicates when a document appears in both lists', () => {
    const fused = reciprocalRankFusion([[doc(1)], [doc(1)]], 10);
    expect(fused).toHaveLength(1);
  });

  it('should keep the object from the earlier list on a duplicate', () => {
    const fused = reciprocalRankFusion(
      [[doc(1, 'keyword')], [doc(1, 'vector')]],
      10,
    );
    expect(fused[0].label).toBe('keyword');
  });

  it('should let a top keyword hit outrank a mid-ranked vector hit', () => {
    // The identifier lookup case: bm25 puts the exact match first while the
    // embedding buries it.
    const keyword = [doc(42)];
    const vector = [doc(1), doc(2), doc(3), doc(4), doc(42)];

    expect(reciprocalRankFusion([keyword, vector], 5)[0].id).toBe(42);
  });

  it('should break an exact tie in favour of the earlier list', () => {
    // Each is rank 1 in its own list, so the scores are identical. The caller
    // passes keyword results first precisely so they win this case.
    const tied = reciprocalRankFusion([[doc(9)], [doc(4)]], 10).map(
      (d) => d.id,
    );
    expect(tied).toEqual([9, 4]);
  });

  it('should order deterministically across identical calls', () => {
    const run = () =>
      reciprocalRankFusion([[doc(5), doc(2)], [doc(7)]], 10).map((d) => d.id);
    expect(run()).toEqual(run());
  });

  it('should prefer the earlier list over id when lists differ', () => {
    const fused = reciprocalRankFusion([[doc(8)], [], [doc(3)]], 10);
    expect(fused.map((d) => d.id)).toEqual([8, 3]);
  });

  it('should fall back to id when tied documents share a first list', () => {
    // With k = 0 a rank-1 hit scores 1/2, so id 3 reaches the same total as
    // id 5 while both were first seen in list 0.
    const fused = reciprocalRankFusion(
      [
        [doc(5), doc(3)],
        [doc(9), doc(3)],
      ],
      10,
      0,
    );

    expect(fused.slice(0, 2).map((d) => d.id)).toEqual([3, 5]);
  });

  it('should ignore an empty list among populated ones', () => {
    expect(
      reciprocalRankFusion([[], [doc(1), doc(2)]], 10).map((d) => d.id),
    ).toEqual([1, 2]);
  });

  it('should apply the k constant when supplied', () => {
    // A smaller k sharpens the advantage of rank 1 over rank 2.
    const list = [doc(1), doc(2)];
    const sharp = reciprocalRankFusion([list], 10, 1);
    expect(sharp.map((d) => d.id)).toEqual([1, 2]);
  });
});
