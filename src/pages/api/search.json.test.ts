import type { SearchResult } from '@logan/libsql-search';
import type { APIContext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST, searchCache } from './search.json';

// Mock dependencies
vi.mock('@logan/libsql-search', () => ({
  search: vi.fn(),
}));

vi.mock('../../lib/turso', () => ({
  getTursoClient: vi.fn(() => ({ execute: vi.fn() })),
}));

const { search } = await import('@logan/libsql-search');
const { getTursoClient } = await import('../../lib/turso');

// Helper to create a minimal APIContext for testing
function createMockContext(
  request: Request,
  clientAddress?: string,
): APIContext {
  return { request, clientAddress } as APIContext;
}

describe('Search API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The result cache is process-wide, so a hit in one test would otherwise
    // satisfy the next one without ever reaching the mocked search.
    searchCache.clear();
    // Every search path resolves Workers AI credentials before querying.
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account-id');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'test-api-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('POST', () => {
    it('should return search results for valid query', async () => {
      const mockResults = [
        {
          id: 1,
          title: 'Test Article',
          slug: 'test',
          folder: 'docs',
          tags: ['test'],
          distance: 0.5,
          content: 'Test content',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(search).mockResolvedValueOnce(mockResults);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query', limit: 5 }),
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([
        {
          id: 1,
          title: 'Test Article',
          slug: 'test',
          folder: 'docs',
          tags: ['test'],
          distance: 0.5,
          excerpt: 'Test content',
        },
      ]);
      expect(data.count).toBe(1);
      expect(data.query).toBe('test query');
    });

    it('should not ship article content to the client', async () => {
      vi.mocked(search).mockResolvedValueOnce([
        {
          id: 1,
          title: 'Test Article',
          slug: 'test',
          folder: 'docs',
          tags: ['test'],
          distance: 0.5,
          content: 'A'.repeat(50_000),
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);

      const response = await POST(
        createMockContext(
          new Request('http://localhost/api/search.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'payload check' }),
          }),
          '192.0.2.14',
        ),
      );
      const body = await response.text();

      expect(body).not.toContain('A'.repeat(1000));
      expect(JSON.parse(body).results[0]).not.toHaveProperty('content');
    });

    it('should serve a repeated query from cache without re-embedding', async () => {
      vi.mocked(search).mockResolvedValue([]);

      const send = () =>
        POST(
          createMockContext(
            new Request('http://localhost/api/search.json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: 'cached query', limit: 5 }),
            }),
            '192.0.2.10',
          ),
        );

      const first = await send();
      const second = await send();

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await second.json()).toEqual(await first.json());
      // The billed embedding call happens inside search(); one call for two
      // requests is the whole point of the cache.
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('should treat a different limit as a separate cache entry', async () => {
      vi.mocked(search).mockResolvedValue([]);

      const send = (limit: number) =>
        POST(
          createMockContext(
            new Request('http://localhost/api/search.json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: 'same query', limit }),
            }),
            '192.0.2.11',
          ),
        );

      await send(5);
      await send(10);

      expect(search).toHaveBeenCalledTimes(2);
    });

    it('should share a cache entry across query casing and padding', async () => {
      vi.mocked(search).mockResolvedValue([]);

      const send = (query: string) =>
        POST(
          createMockContext(
            new Request('http://localhost/api/search.json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, limit: 5 }),
            }),
            '192.0.2.12',
          ),
        );

      await send('Deploy');
      await send('  deploy  ');

      expect(search).toHaveBeenCalledTimes(1);
    });

    it('should build the excerpt around the query term', async () => {
      vi.mocked(search).mockResolvedValueOnce([
        {
          id: 1,
          title: 'Deployment',
          slug: 'deploy',
          folder: 'docs',
          tags: [],
          distance: 0.1,
          content: `${'Filler prose about nothing. '.repeat(20)}The TURSO_DB_URL setting names the database. ${'Trailing filler. '.repeat(20)}`,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);

      const response = await POST(
        createMockContext(
          new Request('http://localhost/api/search.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'TURSO_DB_URL' }),
          }),
          '192.0.2.13',
        ),
      );
      const data = await response.json();

      expect(data.results[0].excerpt).toContain('TURSO_DB_URL');
    });

    it('should return 400 for missing query', async () => {
      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 5 }),
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query parameter is required');
    });

    it('should return 400 for non-string query', async () => {
      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 123, limit: 5 }),
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query parameter is required');
      expect(search).not.toHaveBeenCalled();
      expect(getTursoClient).not.toHaveBeenCalled();
    });

    it('should reject a padded one-character query before searching', async () => {
      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '  a  ' }),
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query too short');
      expect(search).not.toHaveBeenCalled();
      expect(getTursoClient).not.toHaveBeenCalled();
    });

    it('should reject a whitespace-only query before searching', async () => {
      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '   ' }),
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query too short');
      expect(search).not.toHaveBeenCalled();
      expect(getTursoClient).not.toHaveBeenCalled();
    });

    it('should trim a valid query before searching and responding', async () => {
      const mockResults: SearchResult[] = [];
      vi.mocked(search).mockResolvedValueOnce(mockResults);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '  test query  ' }),
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.query).toBe('test query');
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'test query' }),
      );
    });

    it('should use default limit of 10 when not provided', async () => {
      const mockResults: SearchResult[] = [];
      vi.mocked(search).mockResolvedValueOnce(mockResults);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(createMockContext(request));

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test',
          limit: 10,
        }),
      );
    });

    it('should return 500 on search error', async () => {
      vi.mocked(search).mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Search failed');
      // Generic message returned to client (internal details not exposed)
      expect(data.message).toBe(
        'An error occurred while processing your search request.',
      );
    });

    it('should return 400 for invalid JSON body', async () => {
      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const response = await POST(createMockContext(request));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON');
      expect(data.message).toBe('Request body must be valid JSON.');
    });

    it('should use the Cloudflare embedding provider', async () => {
      const mockResults: SearchResult[] = [];
      vi.mocked(search).mockResolvedValueOnce(mockResults);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(createMockContext(request));

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'articles_cf_bgem3_1024',
          embeddingOptions: expect.objectContaining({
            provider: 'cloudflare',
            accountId: 'test-account-id',
            apiToken: 'test-api-token',
            // Guards the table width against the provider's fixed 1024.
            dimensions: 1024,
          }),
        }),
      );
    });

    it('should bound the query-time embedding call', async () => {
      vi.mocked(search).mockResolvedValueOnce([]);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });

      await POST(createMockContext(request));

      const options = vi.mocked(search).mock.calls[0][0];
      expect(options.embeddingOptions.timeoutMs).toBe(5000);
      expect(options.embeddingOptions.signal).toBe(request.signal);
    });

    it.each(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'])(
      'should fail the request when %s is missing',
      async (missingVar) => {
        vi.stubEnv(missingVar, '');

        const request = new Request('http://localhost/api/search.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        });

        const response = await POST(createMockContext(request));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Search failed');

        // Neither the variable name nor either credential value reaches the client.
        const serialized = JSON.stringify(data);
        expect(serialized).not.toContain('CLOUDFLARE');
        expect(serialized).not.toContain('test-api-token');
        expect(serialized).not.toContain('test-account-id');
        expect(search).not.toHaveBeenCalled();
      },
    );

    it('should ignore spoofed proxy headers by default for rate limiting', async () => {
      vi.stubEnv('RATE_LIMIT_TRUSTED_PROXY_HEADER', '');
      vi.mocked(search).mockResolvedValue([]);

      let response: Response | undefined;
      for (let index = 0; index < 21; index++) {
        const request = new Request('http://localhost/api/search.json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': `203.0.113.${index + 1}`,
          },
          // Unique per iteration: identical queries would be served from the
          // result cache and never reach the mocked search, which is what this
          // test counts to prove the limiter let them through.
          body: JSON.stringify({ query: `test query ${index}` }),
        });

        response = await POST(createMockContext(request, '198.51.100.100'));
      }

      expect(response?.status).toBe(429);
      expect(search).toHaveBeenCalledTimes(20);
    });

    it('should use the configured trusted proxy header for rate limiting', async () => {
      vi.stubEnv('RATE_LIMIT_TRUSTED_PROXY_HEADER', 'x-real-ip');
      vi.mocked(search).mockResolvedValue([]);

      let response: Response | undefined;
      for (let index = 0; index < 21; index++) {
        const request = new Request('http://localhost/api/search.json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-real-ip': '203.0.113.200',
          },
          // Unique per iteration so the result cache does not absorb requests
          // this test counts to prove the limiter let them through.
          body: JSON.stringify({ query: `test query ${index}` }),
        });

        response = await POST(
          createMockContext(request, `198.51.100.${index + 101}`),
        );
      }

      expect(response?.status).toBe(429);
      expect(search).toHaveBeenCalledTimes(20);
    });
  });

  describe('GET', () => {
    it('should return 405 for GET requests', async () => {
      const response = await GET({} as APIContext);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Use POST method for search');
    });
  });
});
