import { describe, expect, it } from 'vitest';
import { marked } from './markdown';

describe('marked', () => {
  describe('heading IDs', () => {
    it('should generate heading IDs from text', async () => {
      const result = await marked('## Hello World');
      expect(result).toContain('id="hello-world"');
      expect(result).toContain('<h2');
      expect(result).toContain('Hello World');
    });

    it('should handle multiple headings with different levels', async () => {
      const result = await marked('# Title\n## Subtitle\n### Section');
      expect(result).toContain('id="title"');
      expect(result).toContain('id="subtitle"');
      expect(result).toContain('id="section"');
    });

    it('should convert heading text to lowercase with hyphens', async () => {
      const result = await marked('## This Is A Test');
      expect(result).toContain('id="this-is-a-test"');
    });

    it('should remove special characters from heading IDs', async () => {
      const result = await marked('## Hello, World! (Test)');
      expect(result).toContain('id="hello-world-test"');
    });
  });

  describe('external links', () => {
    it('should add target="_blank" and rel="noopener noreferrer" to external http links', async () => {
      const result = await marked('[Example](http://example.com)');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('should add target="_blank" and rel="noopener noreferrer" to external https links', async () => {
      const result = await marked('[Example](https://example.com)');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('should not add external link attributes to internal links', async () => {
      const result = await marked('[About](/about)');
      expect(result).not.toContain('target="_blank"');
      expect(result).not.toContain('rel="noopener');
    });

    it('should handle link titles', async () => {
      const result = await marked('[Example](https://example.com "Title")');
      expect(result).toContain('title="Title"');
    });
  });

  describe('images', () => {
    it('should add lazy loading to images', async () => {
      const result = await marked('![Alt text](image.jpg)');
      expect(result).toContain('loading="lazy"');
    });

    it('should include alt text', async () => {
      const result = await marked('![Description](image.jpg)');
      expect(result).toContain('alt="Description"');
    });

    it('should handle image titles', async () => {
      const result = await marked('![Alt](image.jpg "Image title")');
      expect(result).toContain('title="Image title"');
    });
  });

  describe('XSS prevention / sanitization', () => {
    it('should sanitize script tags', async () => {
      const result = await marked('<script>alert("xss")</script>');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
    });

    it('should sanitize onclick attributes', async () => {
      const result = await marked('<a href="#" onclick="alert(1)">click</a>');
      expect(result).not.toContain('onclick');
    });

    it('should sanitize javascript: URLs', async () => {
      const result = await marked('[evil](javascript:alert(1))');
      expect(result).not.toContain('javascript:');
    });

    it('should allow safe HTML elements', async () => {
      const result = await marked('**bold** and *italic*');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });

    it('should escape HTML in inline code', async () => {
      const result = await marked('Use `<script>` tag');
      expect(result).toContain('<code>');
    });
  });

  describe('escaping', () => {
    it('should escape special HTML characters in link hrefs', async () => {
      const result = await marked('[test](url?a=1&b=2)');
      expect(result).toContain('&amp;');
    });
  });

  describe('basic markdown rendering', () => {
    it('should render paragraphs', async () => {
      const result = await marked('This is a paragraph.');
      expect(result).toContain('<p>');
    });

    it('should render code blocks', async () => {
      const result = await marked('```\ncode\n```');
      expect(result).toContain('<pre>');
      expect(result).toContain('<code>');
    });

    it('should render lists', async () => {
      const result = await marked('- item 1\n- item 2');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
    });

    it('should render blockquotes', async () => {
      const result = await marked('> quote');
      expect(result).toContain('<blockquote>');
    });
  });
});
