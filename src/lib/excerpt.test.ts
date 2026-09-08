import { describe, expect, it } from 'vitest';
import { buildExcerpt, toPlainText } from './excerpt';

describe('toPlainText', () => {
  it('should keep underscores inside identifiers', () => {
    const text = toPlainText(
      'Use vector_distance_cos with TURSO_DB_URL and CLOUDFLARE_ACCOUNT_ID.',
    );
    expect(text).toContain('vector_distance_cos');
    expect(text).toContain('TURSO_DB_URL');
    expect(text).toContain('CLOUDFLARE_ACCOUNT_ID');
  });

  it('should still strip underscore emphasis at word boundaries', () => {
    expect(toPlainText('a _stressed_ word')).toBe('a stressed word');
    expect(toPlainText('a __very__ stressed word')).toBe(
      'a very stressed word',
    );
  });

  it('should strip asterisk emphasis', () => {
    expect(toPlainText('a **bold** and *italic* word')).toBe(
      'a bold and italic word',
    );
  });

  it('should strip strikethrough', () => {
    expect(toPlainText('a ~~struck~~ word')).toBe('a struck word');
  });

  it('should drop fenced code blocks', () => {
    const text = toPlainText('Intro text\n\n```sql\nSELECT 1;\n```\n\nOutro');
    expect(text).not.toContain('SELECT 1');
    expect(text).toContain('Intro text');
    expect(text).toContain('Outro');
  });

  it('should unwrap inline code without losing its contents', () => {
    expect(toPlainText('run `pnpm index` now')).toBe('run pnpm index now');
  });

  it('should reduce links and images to their text', () => {
    expect(toPlainText('see [the docs](https://example.com) here')).toBe(
      'see the docs here',
    );
    expect(toPlainText('![a diagram](/x.png)')).toBe('a diagram');
  });

  it('should strip heading, quote, and list markers', () => {
    expect(
      toPlainText('## Title\n\n> quoted\n\n- one\n- two\n\n1. three'),
    ).toBe('Title quoted one two three');
  });

  it('should strip html tags', () => {
    expect(toPlainText('a <span class="x">tagged</span> word')).toBe(
      'a tagged word',
    );
  });

  it('should collapse whitespace', () => {
    expect(toPlainText('a\n\n\nb   c')).toBe('a b c');
  });
});

describe('buildExcerpt', () => {
  const long = `Deployment covers a lot of ground. ${'Filler sentence about unrelated topics. '.repeat(8)}The TURSO_DB_URL value configures the remote database connection. ${'More trailing filler here. '.repeat(8)}`;

  it('should return short content unchanged and without ellipses', () => {
    const excerpt = buildExcerpt('A short article body.', 'short');
    expect(excerpt).toBe('A short article body.');
    expect(excerpt).not.toContain('…');
  });

  it('should center the window on the first query term', () => {
    const excerpt = buildExcerpt(long, 'TURSO_DB_URL');
    expect(excerpt).toContain('TURSO_DB_URL');
  });

  it('should stay near the requested length', () => {
    const excerpt = buildExcerpt(long, 'TURSO_DB_URL', 160);
    expect(excerpt.length).toBeLessThanOrEqual(162 + 2);
  });

  it('should fall back to the opening prose when no term matches', () => {
    const excerpt = buildExcerpt(long, 'nonexistentterm');
    expect(excerpt.startsWith('Deployment covers a lot of ground.')).toBe(true);
    expect(excerpt).not.toContain('…Deployment');
  });

  it('should mark a truncated tail with an ellipsis', () => {
    expect(buildExcerpt(long, 'nonexistentterm').endsWith('…')).toBe(true);
  });

  it('should mark a truncated head with an ellipsis', () => {
    expect(buildExcerpt(long, 'TURSO_DB_URL').startsWith('…')).toBe(true);
  });

  it('should use the earliest of several query terms', () => {
    const excerpt = buildExcerpt(long, 'TURSO_DB_URL Deployment');
    expect(excerpt.startsWith('Deployment')).toBe(true);
  });

  it('should ignore one-character query terms when centering', () => {
    const excerpt = buildExcerpt(long, 'a');
    expect(excerpt.startsWith('Deployment')).toBe(true);
  });

  it('should match query terms case-insensitively', () => {
    expect(buildExcerpt(long, 'turso_db_url')).toContain('TURSO_DB_URL');
  });

  it('should strip markdown before excerpting', () => {
    const excerpt = buildExcerpt('# Title\n\nSome **bold** prose.', 'prose');
    expect(excerpt).toBe('Title Some bold prose.');
  });

  it('should handle empty content and empty query', () => {
    expect(buildExcerpt('', 'anything')).toBe('');
    expect(buildExcerpt('Some prose here.', '')).toBe('Some prose here.');
  });

  it('should tolerate null content and null query from the database', () => {
    // libsql can hand back a null column even though the type says string.
    expect(buildExcerpt(null as unknown as string, 'q')).toBe('');
    expect(buildExcerpt('Some prose here.', null as unknown as string)).toBe(
      'Some prose here.',
    );
  });

  it('should fall back to the opening when the query is null on long text', () => {
    const excerpt = buildExcerpt(long, null as unknown as string);
    expect(excerpt.startsWith('Deployment covers a lot of ground.')).toBe(true);
  });

  it('should not trim the tail when the window has no late word break', () => {
    const excerpt = buildExcerpt(`start ${'y'.repeat(500)}`, 'start', 100);
    expect(excerpt).toContain('start');
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('should handle text only slightly longer than the window', () => {
    const text = `${'word '.repeat(33)}end`;
    const excerpt = buildExcerpt(text, 'end', 160);
    expect(excerpt.length).toBeGreaterThan(0);
    expect(excerpt).toContain('end');
  });

  it('should handle a long unbroken run with no spaces to snap to', () => {
    const excerpt = buildExcerpt(`${'x'.repeat(400)}TARGET`, 'TARGET', 100);
    expect(excerpt).toContain('x');
    expect(excerpt.length).toBeLessThanOrEqual(104);
  });

  it('should not split a word at the start of the window', () => {
    const excerpt = buildExcerpt(long, 'TURSO_DB_URL');
    const firstWord = excerpt.replace(/^…/, '').split(' ')[0];
    expect(long).toContain(firstWord);
  });
});
