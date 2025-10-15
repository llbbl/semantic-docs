import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './search.json';

// Mock dependencies
vi.mock('@logan/libsql-search', () => ({
  search: vi.fn(),
}));

vi.mock('../../lib/turso', () => ({
  getTursoClient: vi.fn(() => ({ execute: vi.fn() })),
}));

const { search } = await import('@logan/libsql-search');

describe('Search API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          distance: 0.5
        }
      ];

      vi.mocked(search).mockResolvedValueOnce(mockResults);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query', limit: 5 })
      });

      const response = await POST({ request } as any);
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
        body: JSON.stringify({ limit: 5 })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query parameter is required');
    });

    it('should return 400 for non-string query', async () => {
      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 123, limit: 5 })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query parameter is required');
    });

    it('should use default limit of 10 when not provided', async () => {
      const mockResults = [];
      vi.mocked(search).mockResolvedValueOnce(mockResults);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      });

      await POST({ request } as any);

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test',
          limit: 10,
        })
      );
    });

    it('should return 500 on search error', async () => {
      vi.mocked(search).mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Search failed');
      expect(data.message).toBe('Database connection failed');
    });

    it('should respect embedding provider from environment', async () => {
      vi.stubEnv('EMBEDDING_PROVIDER', 'gemini');

      const mockResults = [];
      vi.mocked(search).mockResolvedValueOnce(mockResults);

      const request = new Request('http://localhost/api/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      });

      await POST({ request } as any);

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          embeddingOptions: {
            provider: 'gemini'
          }
        })
      );

      vi.unstubAllEnvs();
    });
  });

  describe('GET', () => {
    it('should return 405 for GET requests', async () => {
      const response = await GET({} as any);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Use POST method for search');
    });
  });
});