import type { Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @libsql/client
type MockClient = Pick<Client, 'execute' | 'batch' | 'transaction' | 'close'>;

const mockClient: MockClient = {
  execute: vi.fn(),
  batch: vi.fn(),
  transaction: vi.fn(),
  close: vi.fn(),
};

const mockCreateClient = vi.fn(() => mockClient as Client);

vi.mock('@libsql/client', () => ({
  createClient: mockCreateClient,
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@logan/logger', () => ({
  logger: mockLogger,
}));

describe('getTursoClient', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    // Reset the module to clear the singleton
    vi.resetModules();
    // Re-apply mocks after module reset
    vi.doMock('@libsql/client', () => ({
      createClient: mockCreateClient,
    }));
    vi.doMock('@logan/logger', () => ({
      logger: mockLogger,
    }));
    // Clear environment variables
    vi.stubEnv('TURSO_DB_URL', '');
    vi.stubEnv('TURSO_AUTH_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return a Client instance', async () => {
    const { getTursoClient } = await import('./turso');

    const client = getTursoClient();

    expect(client).toBeDefined();
    expect(client).toBe(mockClient);
  });

  it('should return the same instance on subsequent calls (singleton behavior)', async () => {
    const { getTursoClient } = await import('./turso');

    const client1 = getTursoClient();
    const client2 = getTursoClient();
    const client3 = getTursoClient();

    expect(client1).toBe(client2);
    expect(client2).toBe(client3);
    // createClient should only be called once
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('should use Turso remote when both URL and authToken are provided via process.env', async () => {
    vi.stubEnv('TURSO_DB_URL', 'libsql://test-db.turso.io');
    vi.stubEnv('TURSO_AUTH_TOKEN', 'test-auth-token');

    const { getTursoClient } = await import('./turso');

    getTursoClient();

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'libsql://test-db.turso.io',
      authToken: 'test-auth-token',
    });
  });

  it('should fall back to process.env when import.meta.env is empty', async () => {
    vi.stubEnv('TURSO_DB_URL', '');
    vi.stubEnv('TURSO_AUTH_TOKEN', '');
    process.env.TURSO_DB_URL = 'libsql://process.turso.io';
    process.env.TURSO_AUTH_TOKEN = 'process-token';

    const { getTursoClient } = await import('./turso');

    getTursoClient();

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'libsql://process.turso.io',
      authToken: 'process-token',
    });
  });

  it('should fall back to local file when URL is missing', async () => {
    vi.stubEnv('TURSO_DB_URL', '');
    vi.stubEnv('TURSO_AUTH_TOKEN', 'test-auth-token');

    const { getTursoClient } = await import('./turso');

    getTursoClient();

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'file:local.db',
    });
  });

  it('should fall back to local file when authToken is missing', async () => {
    vi.stubEnv('TURSO_DB_URL', 'libsql://test-db.turso.io');
    vi.stubEnv('TURSO_AUTH_TOKEN', '');

    const { getTursoClient } = await import('./turso');

    getTursoClient();

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'file:local.db',
    });
  });

  it('should fall back to local file when both URL and authToken are missing', async () => {
    vi.stubEnv('TURSO_DB_URL', '');
    vi.stubEnv('TURSO_AUTH_TOKEN', '');

    const { getTursoClient } = await import('./turso');

    getTursoClient();

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'file:local.db',
    });
  });

  it('should log info message when using Turso remote database', async () => {
    vi.stubEnv('TURSO_DB_URL', 'libsql://production.turso.io');
    vi.stubEnv('TURSO_AUTH_TOKEN', 'production-token');

    const { getTursoClient } = await import('./turso');

    getTursoClient();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Using Turso database: libsql://production.turso.io',
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should log warning message when falling back to local database', async () => {
    vi.stubEnv('TURSO_DB_URL', '');
    vi.stubEnv('TURSO_AUTH_TOKEN', '');

    const { getTursoClient } = await import('./turso');

    getTursoClient();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Turso credentials not found, using local libSQL database',
    );
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('should only log once even when called multiple times', async () => {
    vi.stubEnv('TURSO_DB_URL', 'libsql://test.turso.io');
    vi.stubEnv('TURSO_AUTH_TOKEN', 'test-token');

    const { getTursoClient } = await import('./turso');

    getTursoClient();
    getTursoClient();
    getTursoClient();

    // Logging should only happen on first call when client is created
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });
});

describe('turso module re-exports', () => {
  it('should re-export getAllArticles from libsql-search', async () => {
    const tursoModule = await import('./turso');
    const libsqlSearch = await import('@logan/libsql-search');
    expect(tursoModule.getAllArticles).toBe(libsqlSearch.getAllArticles);
  });

  it('should re-export getArticleBySlug from libsql-search', async () => {
    const tursoModule = await import('./turso');
    const libsqlSearch = await import('@logan/libsql-search');
    expect(tursoModule.getArticleBySlug).toBe(libsqlSearch.getArticleBySlug);
  });

  it('should re-export getArticlesByFolder from libsql-search', async () => {
    const tursoModule = await import('./turso');
    const libsqlSearch = await import('@logan/libsql-search');
    expect(tursoModule.getArticlesByFolder).toBe(
      libsqlSearch.getArticlesByFolder,
    );
  });

  it('should re-export getFolders from libsql-search', async () => {
    const tursoModule = await import('./turso');
    const libsqlSearch = await import('@logan/libsql-search');
    expect(tursoModule.getFolders).toBe(libsqlSearch.getFolders);
  });
});
