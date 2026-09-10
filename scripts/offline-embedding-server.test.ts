import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmbeddingHandler, embedText } from './offline-embedding-server';

const DIMENSIONS = 1024;

function cosine(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('embedText', () => {
  it('returns a unit vector of the requested width', () => {
    const vector = embedText('semantic search', DIMENSIONS);

    expect(vector).toHaveLength(DIMENSIONS);
    expect(cosine(vector, vector)).toBeCloseTo(1, 10);
  });

  it('is deterministic across calls', () => {
    expect(embedText('hybrid search', DIMENSIONS)).toEqual(
      embedText('hybrid search', DIMENSIONS),
    );
  });

  it('ignores case and punctuation, so the same words embed alike', () => {
    expect(embedText('Vector Search!', DIMENSIONS)).toEqual(
      embedText('vector search', DIMENSIONS),
    );
  });

  it('scores shared tokens above disjoint ones', () => {
    const document = embedText(
      'semantic search over markdown documents',
      DIMENSIONS,
    );
    const related = embedText('semantic search', DIMENSIONS);
    const unrelated = embedText('quarterly financial projections', DIMENSIONS);

    expect(cosine(document, related)).toBeGreaterThan(
      cosine(document, unrelated),
    );
  });

  it.each(['', '   ', '!!!'])('still returns a unit vector for %o', (text) => {
    const vector = embedText(text, DIMENSIONS);

    expect(vector).toHaveLength(DIMENSIONS);
    expect(cosine(vector, vector)).toBeCloseTo(1, 10);
  });
});

describe('createEmbeddingHandler', () => {
  const handle = createEmbeddingHandler(DIMENSIONS);

  it('returns one indexed embedding per input, in order', () => {
    const { status, payload } = handle(
      JSON.stringify({
        input: ['one', 'two', 'three'],
        dimensions: DIMENSIONS,
      }),
    );
    const data = (payload as { data: Array<{ index: number }> }).data;

    expect(status).toBe(200);
    expect(data.map((item) => item.index)).toEqual([0, 1, 2]);
  });

  it('honours the requested dimensions', () => {
    const { payload } = handle(
      JSON.stringify({ input: ['one'], dimensions: 8 }),
    );
    const data = (payload as { data: Array<{ embedding: number[] }> }).data;

    expect(data[0].embedding).toHaveLength(8);
  });

  it('falls back to the configured width when dimensions are absent', () => {
    const { payload } = handle(JSON.stringify({ input: ['one'] }));
    const data = (payload as { data: Array<{ embedding: number[] }> }).data;

    expect(data[0].embedding).toHaveLength(DIMENSIONS);
  });

  it('accepts a bare string input', () => {
    const { status, payload } = handle(JSON.stringify({ input: 'one' }));

    expect(status).toBe(200);
    expect((payload as { data: unknown[] }).data).toHaveLength(1);
  });

  it.each([
    ['invalid JSON', '{'],
    ['a missing input', '{}'],
    ['a non-string array', JSON.stringify({ input: [1, 2] })],
    ['zero dimensions', JSON.stringify({ input: ['a'], dimensions: 0 })],
  ])('rejects %s', (_label, body) => {
    expect(handle(body).status).toBe(400);
  });
});
