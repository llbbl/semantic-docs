/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(
  resolve(process.cwd(), './src/layouts/DocsLayout.astro'),
  'utf8',
);

describe('DocsLayout theme prepaint script', () => {
  it('uses the generated prepaint script', () => {
    expect(layout).toContain(
      "import { themePrepaintScript } from '@/config/themes';",
    );
    expect(layout).toContain(
      '<script is:inline set:html={themePrepaintScript} />',
    );
  });

  it('runs the script before the body opens', () => {
    expect(layout.indexOf('set:html={themePrepaintScript}')).toBeLessThan(
      layout.indexOf('<body'),
    );
  });

  it('no longer inlines the partial token subset', () => {
    expect(layout).not.toContain('foucThemes');
    expect(layout).not.toContain('foucScript');
  });
});
