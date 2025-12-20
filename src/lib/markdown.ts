import { marked } from 'marked';

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
      const titleAttr = title ? ` title="${title}"` : '';
      if (href?.startsWith('http://') || href?.startsWith('https://')) {
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return `<a href="${href}"${titleAttr}>${text}</a>`;
    },
    image({ href, title, text }) {
      const alt = text || 'Image';
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${href}" alt="${alt}"${titleAttr} loading="lazy" />`;
    },
  },
});

export { marked };
