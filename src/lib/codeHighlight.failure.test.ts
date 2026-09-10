/**
 * Isolated because it mocks the Shiki core module, which the highlighter
 * singleton in codeHighlight.ts resolves once per module instance.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('shiki/core');
  vi.resetModules();
});

describe('highlightCode when the highlighter fails', () => {
  it('degrades to plain rendering rather than failing the build', async () => {
    vi.resetModules();
    vi.doMock('shiki/core', async () => {
      const actual =
        await vi.importActual<typeof import('shiki/core')>('shiki/core');
      return {
        ...actual,
        createHighlighterCore: async () => ({
          codeToHtml: () => {
            throw new Error('grammar exploded');
          },
        }),
      };
    });

    const { highlightCode } = await import('./codeHighlight');

    // A thrown highlighter must not fail the build; the code renderer falls
    // back to a plain block when this returns null.
    await expect(highlightCode('const a = 1;', 'ts')).resolves.toBeNull();
  });
});
