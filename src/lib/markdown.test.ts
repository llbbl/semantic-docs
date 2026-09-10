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

    it('should slug the plain text of a heading, not its rendered HTML', async () => {
      const result = await marked('## Run `pnpm index`');
      expect(result).toContain('id="run-pnpm-index"');
    });

    it('should ignore link markup when building a heading ID', async () => {
      const result = await marked('## See [the docs](https://example.com)');
      expect(result).toContain('id="see-the-docs"');
    });

    it('should ignore emphasis markup when building a heading ID', async () => {
      const result = await marked('## **Bold** and _italic_');
      expect(result).toContain('id="bold-and-italic"');
    });

    it('should suffix duplicate headings instead of colliding', async () => {
      const result = await marked('## Example\n\n## Example\n\n## Example');
      expect(result).toContain('id="example"');
      expect(result).toContain('id="example-1"');
      expect(result).toContain('id="example-2"');
    });

    it('should not collide when a suffixed ID matches a later heading', async () => {
      const result = await marked('## Example\n\n## Example\n\n## Example 1');
      const ids = [...result.matchAll(/id="([^"]*)"/g)].map((m) => m[1]);
      expect(ids).toEqual(['example', 'example-1', 'example-1-1']);
    });

    it('should de-duplicate per document rather than across calls', async () => {
      const first = await marked('## Example');
      const second = await marked('## Example');
      expect(first).toContain('id="example"');
      expect(second).toContain('id="example"');
    });

    it('should fall back to a usable ID when a heading slugs to nothing', async () => {
      const result = await marked('## 🎉\n\n## ---');
      expect(result).toContain('id="section"');
      expect(result).toContain('id="section-1"');
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

    it('should drop the href of a link with an empty target', async () => {
      const result = await marked('[Example]()');
      expect(result).toContain('<a>Example</a>');
      expect(result).not.toContain('href');
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

    it('should fall back to a default alt when the image has none', async () => {
      const result = await marked('![](https://example.com/a.png)');
      expect(result).toContain('alt="Image"');
    });

    it('should drop the src of an image with an empty target', async () => {
      const result = await marked('![Alt]()');
      expect(result).toContain('<img alt="Alt"');
      expect(result).not.toContain('src=');
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

  describe('syntax highlighting', () => {
    it('should highlight a fenced block with a known language', async () => {
      const result = await marked('```ts\nconst x = 1; // note\n```');
      expect(result).toContain('<div class="code-block">');
      expect(result).toContain('<pre class="shiki">');
      expect(result).toContain('<code class="language-ts">');
      expect(result).toContain('class="sh-keyword"');
      expect(result).toContain('class="sh-comment"');
    });

    it('should resolve language aliases', async () => {
      const result = await marked('```sh\necho hi\n```');
      expect(result).toContain('class="language-sh"');
      expect(result).toContain('class="sh-');
    });

    it('should fall back to plain rendering for an unknown language', async () => {
      const result = await marked('```brainfuck\n+++.\n```');
      expect(result).toContain('<pre><code class="language-brainfuck">');
      expect(result).not.toContain('class="sh-');
    });

    it('should fall back to plain rendering for an unfenced-language block', async () => {
      const result = await marked('```\njust text\n```');
      expect(result).toContain('<pre><code>just text');
      expect(result).not.toContain('class="sh-');
    });

    it('should still wrap plain blocks so they get a copy button', async () => {
      const result = await marked('```\njust text\n```');
      expect(result).toContain('<div class="code-block">');
    });

    it('should escape HTML inside a highlighted block', async () => {
      const result = await marked(
        '```ts\nconst s = "<img src=x onerror=alert(1)>";\n```',
      );
      // The attribute text survives as escaped content, which is the point:
      // it is displayed, never parsed as markup.
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('should escape HTML inside a plain block', async () => {
      const result = await marked('```\n<script>alert(1)</script>\n```');
      expect(result).not.toContain('<script');
      expect(result).toContain('&lt;script');
    });

    it('should not emit a language class for a malformed fence info string', async () => {
      const result = await marked('```<script>\nx\n```');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('class="language-');
    });
  });

  describe('class and style sanitization', () => {
    it('should not let any inline style attribute survive', async () => {
      const result = await marked(
        [
          '```ts',
          'const x: number = 1; // note',
          '```',
          '',
          '```python',
          'def f(a):\n    return f"v={a}"',
          '```',
          '',
          '<p style="color:red">styled</p>',
          '',
          '<span style="color:red" class="sh-keyword">also styled</span>',
        ].join('\n'),
      );
      expect(result).not.toMatch(/style\s*=/);
    });

    it('should strip classes that are not on the allowlist', async () => {
      const result = await marked(
        '<div class="code-block evil"><span class="sh-keyword nope">x</span></div>',
      );
      expect(result).toContain('class="code-block"');
      expect(result).toContain('class="sh-keyword"');
      expect(result).not.toContain('evil');
      expect(result).not.toContain('nope');
    });

    it('should strip classes from tags that allow none', async () => {
      const result = await marked('<p class="sh-keyword">x</p>');
      expect(result).toContain('<p>x</p>');
    });

    it('should reject a language class that is not a plain language name', async () => {
      const result = await marked(
        '<code class="language-ts">ok</code> <code class="language- bad">no</code>',
      );
      expect(result).toContain('<code class="language-ts">');
      expect(result).not.toContain('bad');
    });
  });
});
