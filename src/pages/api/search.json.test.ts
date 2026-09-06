import type { SearchResult } from '@logan/libsql-search';
import type { APIContext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './search.json';

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
      expect(data.results).toEqual(mockResults);
      expect(data.count).toBe(1);
      expect(data.query).toBe('test query');
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
          body: JSON.stringify({ query: 'test query' }),
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
          body: JSON.stringify({ query: 'test query' }),
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
