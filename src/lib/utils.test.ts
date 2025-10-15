import { describe, expect, it } from 'vitest';
import {
  extractHeadings,
  formatDate,
  formatFolderName,
  slugify,
  truncate,
} from './utils';

describe('formatFolderName', () => {
  it('should return "Documentation" for root folder', () => {
    expect(formatFolderName('root')).toBe('Documentation');
  });

  it('should convert kebab-case to Title Case', () => {
    expect(formatFolderName('getting-started')).toBe('Getting Started');
    expect(formatFolderName('api-reference')).toBe('Api Reference');
  });

  it('should handle single word folders', () => {
    expect(formatFolderName('guides')).toBe('Guides');
  });

  it('should handle multiple hyphens', () => {
    expect(formatFolderName('how-to-get-started')).toBe('How To Get Started');
  });
});

describe('truncate', () => {
  it('should not truncate text shorter than maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('should truncate text longer than maxLength', () => {
    expect(truncate('This is a very long text', 10)).toBe('This is a...');
  });

  it('should handle exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('should trim whitespace before adding ellipsis', () => {
    expect(truncate('Hello world', 6)).toBe('Hello...');
  });
});

describe('slugify', () => {
  it('should convert text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('Test @ 123')).toBe('test-123');
  });

  it('should replace spaces with hyphens', () => {
    expect(slugify('Getting Started Guide')).toBe('getting-started-guide');
  });

  it('should handle multiple consecutive spaces', () => {
    expect(slugify('Hello    World')).toBe('hello-world');
  });

  it('should remove leading and trailing hyphens', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
    expect(slugify('-Hello-')).toBe('hello');
  });

  it('should handle underscores', () => {
    expect(slugify('hello_world')).toBe('hello-world');
  });
});

describe('formatDate', () => {
  it('should format date string', () => {
    const date = '2024-01-15T12:00:00.000Z';
    const result = formatDate(date);
    expect(result).toContain('2024');
    expect(result).toContain('January');
  });

  it('should format Date object', () => {
    const date = new Date('2024-01-15T12:00:00.000Z');
    const result = formatDate(date);
    expect(result).toContain('2024');
    expect(result).toContain('January');
  });

  it('should handle ISO date strings', () => {
    const date = '2024-12-25T12:00:00.000Z';
    expect(formatDate(date)).toContain('2024');
    expect(formatDate(date)).toContain('December');
  });

  it('should return a properly formatted string', () => {
    const date = new Date('2024-06-15T12:00:00.000Z');
    const result = formatDate(date);
    // Should match format: "Month Day, Year"
    expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  });
});

describe('extractHeadings', () => {
  it('should extract h2 headings with ids', () => {
    const html = '<h2 id="intro">Introduction</h2><p>Content</p>';
    const headings = extractHeadings(html);

    expect(headings).toHaveLength(1);
    expect(headings[0]).toEqual({
      level: 2,
      id: 'intro',
      text: 'Introduction',
    });
  });

  it('should extract h3 headings with ids', () => {
    const html = '<h3 id="sub-section">Sub Section</h3><p>Content</p>';
    const headings = extractHeadings(html);

    expect(headings).toHaveLength(1);
    expect(headings[0]).toEqual({
      level: 3,
      id: 'sub-section',
      text: 'Sub Section',
    });
  });

  it('should extract multiple headings in order', () => {
    const html = `
      <h2 id="one">First</h2>
      <p>Content</p>
      <h3 id="two">Second</h3>
      <h2 id="three">Third</h2>
    `;
    const headings = extractHeadings(html);

    expect(headings).toHaveLength(3);
    expect(headings[0].text).toBe('First');
    expect(headings[1].text).toBe('Second');
    expect(headings[2].text).toBe('Third');
  });

  it('should strip HTML tags from heading text', () => {
    const html = '<h2 id="code"><code>const</code> variable</h2>';
    const headings = extractHeadings(html);

    expect(headings[0].text).toBe('const variable');
  });

  it('should return empty array for no headings', () => {
    const html = '<p>Just a paragraph</p>';
    expect(extractHeadings(html)).toEqual([]);
  });

  it('should ignore h1 headings', () => {
    const html = '<h1 id="title">Title</h1><h2 id="section">Section</h2>';
    const headings = extractHeadings(html);

    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Section');
  });

  it('should ignore headings without ids', () => {
    const html = '<h2>No ID</h2><h2 id="with-id">With ID</h2>';
    const headings = extractHeadings(html);

    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('With ID');
  });
});
