import { describe, expect, it, vi } from 'vitest';
import {
  type IndexingLogger,
  type IndexingOperations,
  runContentIndexing,
} from './index-content-runner';

function createLogger(): IndexingLogger {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe('runContentIndexing', () => {
  it('returns zero and preserves progress reporting on complete success', async () => {
    const logger = createLogger();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn(async (onProgress) => {
        onProgress(1, 2, 'getting-started/welcome.md');
        onProgress(2, 2, 'theme/overview.md');
        return { success: 2, total: 2, failed: 0 };
      }),
    };

    const exitCode = await runContentIndexing(operations, logger);

    expect(exitCode).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      '[1/2] Indexing: getting-started/welcome.md',
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[2/2] Indexing: theme/overview.md',
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Successfully indexed 2/2 documents',
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns nonzero after logging a partial-failure summary', async () => {
    const logger = createLogger();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi
        .fn()
        .mockResolvedValue({ success: 2, total: 3, failed: 1 }),
    };

    const exitCode = await runContentIndexing(operations, logger);

    expect(exitCode).toBe(1);
    expect(logger.info).toHaveBeenCalledWith('Indexing complete!');
    expect(logger.info).toHaveBeenCalledWith(
      'Successfully indexed 2/3 documents',
    );
    expect(logger.warn).toHaveBeenCalledWith('Failed to index 1 documents');
  });

  it('returns nonzero and logs thrown indexing errors', async () => {
    const logger = createLogger();
    const indexingError = new Error('embedding failed');
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn().mockRejectedValue(indexingError),
    };

    const exitCode = await runContentIndexing(operations, logger);

    expect(exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Content indexing failed before completion',
      indexingError,
    );
  });
});
