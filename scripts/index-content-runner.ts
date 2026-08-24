export interface IndexingResult {
  success: number;
  total: number;
  failed: number;
}

export type IndexProgress = (
  current: number,
  total: number,
  file: string,
) => void;

export interface IndexingOperations {
  createTable: () => Promise<unknown>;
  indexContent: (onProgress: IndexProgress) => Promise<IndexingResult>;
}

export interface IndexingLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

/**
 * Run content indexing and return the process exit code the CLI should use.
 */
export async function runContentIndexing(
  operations: IndexingOperations,
  logger: IndexingLogger,
): Promise<0 | 1> {
  logger.info('Starting content indexing...');

  try {
    await operations.createTable();

    const result = await operations.indexContent((current, total, file) => {
      logger.info(`[${current}/${total}] Indexing: ${file}`);
    });

    logger.info('Indexing complete!');
    logger.info(
      `Successfully indexed ${result.success}/${result.total} documents`,
    );

    if (result.failed > 0) {
      logger.warn(`Failed to index ${result.failed} documents`);
      return 1;
    }

    return 0;
  } catch (error) {
    logger.error('Content indexing failed before completion', error);
    return 1;
  }
}
