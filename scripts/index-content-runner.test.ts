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
  it('rebuilds the keyword index after the rows are written', async () => {
    const order: string[] = [];
    const logger = createLogger();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn(async () => {
        order.push('indexContent');
        return { success: 1, total: 1, failed: 0 };
      }),
      rebuildKeywordIndex: vi.fn(async () => {
        order.push('rebuildKeywordIndex');
      }),
    };

    const exitCode = await runContentIndexing(operations, logger);

    expect(exitCode).toBe(0);
    // Order matters: a keyword index built first would describe rows a failed
    // embedding run never wrote.
    expect(order).toEqual(['indexContent', 'rebuildKeywordIndex']);
    expect(logger.info).toHaveBeenCalledWith('Rebuilt keyword index');
  });

  it('skips the keyword rebuild when no operation is supplied', async () => {
    const logger = createLogger();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn().mockResolvedValue({
        success: 1,
        total: 1,
        failed: 0,
      }),
    };

    expect(await runContentIndexing(operations, logger)).toBe(0);
    expect(logger.info).not.toHaveBeenCalledWith('Rebuilt keyword index');
  });

  it('does not rebuild the keyword index when indexing throws', async () => {
    const logger = createLogger();
    const rebuildKeywordIndex = vi.fn();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn().mockRejectedValue(new Error('embedding failed')),
      rebuildKeywordIndex,
    };

    expect(await runContentIndexing(operations, logger)).toBe(1);
    expect(rebuildKeywordIndex).not.toHaveBeenCalled();
  });

  it('applies navigation frontmatter after the rows are written', async () => {
    const order: string[] = [];
    const logger = createLogger();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn(async () => {
        order.push('indexContent');
        return { success: 1, total: 1, failed: 0 };
      }),
      applyNavFrontmatter: vi.fn(async () => {
        order.push('applyNavFrontmatter');
        return 3;
      }),
    };

    expect(await runContentIndexing(operations, logger)).toBe(0);
    // indexContent clears and reinserts the table, so an earlier pass would be
    // overwritten.
    expect(order).toEqual(['indexContent', 'applyNavFrontmatter']);
    expect(logger.info).toHaveBeenCalledWith(
      'Applied navigation frontmatter to 3 documents',
    );
  });

  it('skips the frontmatter pass when no operation is supplied', async () => {
    const logger = createLogger();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn().mockResolvedValue({
        success: 1,
        total: 1,
        failed: 0,
      }),
    };

    expect(await runContentIndexing(operations, logger)).toBe(0);
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('navigation frontmatter'),
    );
  });

  it('does not apply frontmatter when indexing throws', async () => {
    const logger = createLogger();
    const applyNavFrontmatter = vi.fn();
    const operations: IndexingOperations = {
      createTable: vi.fn().mockResolvedValue(undefined),
      indexContent: vi.fn().mockRejectedValue(new Error('embedding failed')),
      applyNavFrontmatter,
    };

    expect(await runContentIndexing(operations, logger)).toBe(1);
    expect(applyNavFrontmatter).not.toHaveBeenCalled();
  });
});
