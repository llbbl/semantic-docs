/**
 * @vitest-environment node
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createEmbeddingHandler,
  embedText,
  startOfflineEmbeddingServer,
} from './offline-embedding-server';

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

describe('startOfflineEmbeddingServer', () => {
  let server: ReturnType<typeof startOfflineEmbeddingServer>;
  let baseUrl: string;

  beforeAll(async () => {
    // Port 0 so parallel runs cannot collide on a fixed port.
    server = startOfflineEmbeddingServer(0);
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server did not bind a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('binds loopback only', () => {
    const address = server.address();
    expect(address).toMatchObject({ address: '127.0.0.1' });
  });

  it('answers the health probe', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('serves the embeddings path under any base prefix', async () => {
    const response = await fetch(`${baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: ['a', 'b'], dimensions: DIMENSIONS }),
    });
    const body = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };

    expect(response.status).toBe(200);
    expect(body.data.map((item) => item.index)).toEqual([0, 1]);
    expect(body.data[0].embedding).toHaveLength(DIMENSIONS);
  });

  it.each([
    ['GET', '/v1/embeddings'],
    ['POST', '/v1/nope'],
  ])('404s %s %s', async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, { method });

    expect(response.status).toBe(404);
  });

  // An unbounded width reached new Array() and killed the process, which
  // surfaced only as a connection error partway through indexing.
  it('rejects an absurd width instead of dying', async () => {
    const response = await fetch(`${baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: ['a'], dimensions: 2 ** 32 }),
    });

    expect(response.status).toBe(400);

    const stillAlive = await fetch(`${baseUrl}/health`);
    expect(stillAlive.status).toBe(200);
  });

  it('survives a malformed body', async () => {
    const response = await fetch(`${baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(response.status).toBe(400);
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
  });
});
