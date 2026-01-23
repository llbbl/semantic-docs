import { marked } from 'marked';

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

marked.use({
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

export { marked };
