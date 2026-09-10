/**
 * Deterministic embedding service for CI and local development.
 *
 * Serves the OpenAI-compatible `/embeddings` contract so libsql-search's
 * `openai-compatible` provider can index and query without credentials or a
 * network. Vectors are a hashed bag of words: shared tokens raise cosine
 * similarity, so search results are meaningful rather than arbitrary, and the
 * same text always produces the same vector.
 *
 * Not a model. It has no semantics beyond token overlap, so it can verify that
 * indexing, prerendering and search execute end to end, and nothing about
 * retrieval quality.
 */

import { createServer, type IncomingMessage } from 'node:http';
import { logger } from 'logan-logger';
import { EMBEDDING_DIMENSIONS } from '../src/lib/searchConfig';

const DEFAULT_PORT = 8788;

// Comfortably above any embedding width in use; the cap exists to bound the
// allocation a request can ask for, not to describe a real model.
const MAX_DIMENSIONS = 8192;

/** FNV-1a. Chosen for being short and stable across runs, not for quality. */
function hashToken(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function embedText(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];

  for (const token of tokens) {
    const hash = hashToken(token);
    // The sign comes from the high bit because the bucket consumes the low
    // ones: with a power-of-two width, a low-bit sign is fixed per bucket and
    // every cosine stays positive, so unrelated documents never separate.
    vector[hash % dimensions] += (hash >>> 31) & 1 ? 1 : -1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) {
    // An empty or punctuation-only input still needs a unit vector, since the
    // provider rejects a dimension mismatch and cosine distance needs a norm.
    vector[0] = 1;
    return vector;
  }

  return vector.map((v) => v / magnitude);
}

interface EmbeddingsRequestBody {
  input?: unknown;
  model?: unknown;
  dimensions?: unknown;
}

function readInputTexts(body: EmbeddingsRequestBody): string[] | null {
  const { input } = body;
  if (typeof input === 'string') return [input];
  if (Array.isArray(input) && input.every((v) => typeof v === 'string')) {
    return input as string[];
  }
  return null;
}

export function createEmbeddingHandler(defaultDimensions: number) {
  return function handle(rawBody: string): {
    status: number;
    payload: unknown;
  } {
    let body: EmbeddingsRequestBody;
    try {
      body = JSON.parse(rawBody) as EmbeddingsRequestBody;
    } catch {
      return { status: 400, payload: { error: 'invalid JSON body' } };
    }

    const texts = readInputTexts(body);
    if (!texts) {
      return {
        status: 400,
        payload: { error: 'input must be a string or an array of strings' },
      };
    }

    const dimensions =
      typeof body.dimensions === 'number' && Number.isInteger(body.dimensions)
        ? body.dimensions
        : defaultDimensions;

    // Bounded before it reaches `new Array()`: an unbounded value either throws
    // RangeError or allocates until the process dies, and this handler runs
    // inside a request callback where either would take the service down.
    if (dimensions < 1 || dimensions > MAX_DIMENSIONS) {
      return {
        status: 400,
        payload: {
          error: `dimensions must be between 1 and ${MAX_DIMENSIONS}`,
        },
      };
    }

    return {
      status: 200,
      payload: {
        object: 'list',
        model: typeof body.model === 'string' ? body.model : 'offline-hash',
        // The provider requires an index on every item and matches the
        // response back to the request by it.
        data: texts.map((text, index) => ({
          object: 'embedding',
          index,
          embedding: embedText(text, dimensions),
        })),
      },
    };
  };
}

function readBody(
  stream: IncomingMessage,
  limitBytes: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        // Stop the sender rather than letting it keep uploading into a response
        // that has already been ended.
        stream.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', () => resolve(null));
  });
}

// Indexing sends whole article bodies in batches, so the cap is generous;
// it exists only so a runaway request cannot exhaust memory.
const MAX_BODY_BYTES = 32 * 1024 * 1024;

export function startOfflineEmbeddingServer(port: number) {
  const handle = createEmbeddingHandler(EMBEDDING_DIMENSIONS);

  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method !== 'POST' || !path.endsWith('/embeddings')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    void readBody(req, MAX_BODY_BYTES)
      .then((rawBody) => {
        if (rawBody === null) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'request body too large' }));
          return;
        }

        const { status, payload } = handle(rawBody);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      })
      // Without this a throw here is an unhandled rejection that ends the
      // process, surfacing much later as a connection error during indexing.
      .catch((error: unknown) => {
        logger.error('Offline embedding request failed', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: 'internal error' }));
      });
  });

  // Loopback only. This service authenticates nothing and must not be
  // reachable from outside the machine running it.
  server.listen(port, '127.0.0.1', () => {
    logger.info(
      `Offline embedding service on http://127.0.0.1:${port}/v1 (${EMBEDDING_DIMENSIONS} dimensions)`,
    );
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(
    process.env.OFFLINE_EMBEDDINGS_PORT ?? String(DEFAULT_PORT),
    10,
  );
  startOfflineEmbeddingServer(Number.isInteger(port) ? port : DEFAULT_PORT);
}
