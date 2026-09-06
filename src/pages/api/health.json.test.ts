import type { APIContext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './health.json';

vi.mock('../../lib/turso', () => ({
  getTursoClient: vi.fn(),
}));

const { getTursoClient } = await import('../../lib/turso');

function mockDb(execute: () => Promise<unknown>) {
  vi.mocked(getTursoClient).mockReturnValue({
    execute,
  } as unknown as ReturnType<typeof getTursoClient>);
}

const context = {} as APIContext;

describe('Health API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account-id');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'test-api-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should report ok when the search table reads and credentials are set', async () => {
    mockDb(() => Promise.resolve({ rows: [] }));

    const response = await GET(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      checks: { database: true, embeddings: true },
    });
  });

  it('should query the search table rather than only pinging the connection', async () => {
    const execute = vi.fn(() => Promise.resolve({ rows: [] }));
    mockDb(execute);

    await GET(context);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('articles_cf_bgem3_1024'),
    );
  });

  it('should report unhealthy when the database is unreachable', async () => {
    mockDb(() => Promise.reject(new Error('connection refused')));

    const response = await GET(context);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { database: false, embeddings: true },
    });
  });

  it('should report unhealthy when Workers AI credentials are missing', async () => {
    mockDb(() => Promise.resolve({ rows: [] }));
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '');

    const response = await GET(context);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { database: true, embeddings: false },
    });
  });

  it('should never let an orchestrator cache the verdict', async () => {
    mockDb(() => Promise.resolve({ rows: [] }));

    const response = await GET(context);

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
