import { marked as markedBase } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

markedBase.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');
      return `<h${depth} id="${id}">${text}</h${depth}>`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const escapedHref = escapeHtml(href || '');
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      if (href?.startsWith('http://') || href?.startsWith('https://')) {
        return `<a href="${escapedHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return `<a href="${escapedHref}"${titleAttr}>${text}</a>`;
    },
    image({ href, title, text }) {
      const escapedAlt = escapeHtml(text || 'Image');
      const escapedHref = escapeHtml(href || '');
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapedHref}" alt="${escapedAlt}"${titleAttr} loading="lazy" />`;
    },
  },
});

/**
 * Sanitization configuration for markdown HTML output
 * Allows common markdown elements while preventing XSS attacks
 */
const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'img',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'div',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading', 'width', 'height'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    code: ['class'],
    pre: ['class'],
    '*': ['class'], // Allow class on any element for styling
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  // Ensure href and src are valid URLs
  allowedSchemesAppliedToAttributes: ['href', 'src'],
};

/**
 * Parse markdown to HTML with sanitization
 * Wraps marked output to ensure XSS protection
 */
async function marked(content: string): Promise<string> {
  const html = await markedBase(content);
  return sanitizeHtml(html, sanitizeOptions);
}

export { marked };
