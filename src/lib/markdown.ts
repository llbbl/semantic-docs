import { Marked, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import {
  CODE_BLOCK_CLASS,
  CODE_LINE_CLASS,
  CODE_PRE_CLASS,
  highlightCode,
  SYNTAX_TOKEN_CLASSES,
} from './codeHighlight';
import { slugify } from './utils';

// Allowlist of URL schemes considered safe to emit in href/src attributes.
// Defense-in-depth: sanitize-html also enforces this on the post-render pass,
// but pre-rendering with `javascript:` text would still let the attribute
// reach the sanitizer, and any future removal of sanitize-html would silently
// reintroduce XSS. Keep this aligned with `allowedSchemes` below.
const SAFE_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];
const SAFE_IMAGE_SCHEMES = ['http:', 'https:', 'data:'];

function isSafeUrl(
  href: string | undefined,
  schemes: string[],
): href is string {
  if (!href) return false;
  // Browsers tolerate leading whitespace in href/src, so the scheme check
  // must run against the trimmed value too — otherwise `"  javascript:..."`
  // looks scheme-less and would slip through as "relative".
  const v = href.trim().toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*:/.test(v)) return true;
  return schemes.some((s) => v.startsWith(s));
}

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

/** marked's own fence class, e.g. `language-ts`, kept on both render paths. */
const LANGUAGE_CLASS_PATTERN = /^language-[a-z0-9][a-z0-9+#._-]*$/i;

/**
 * The unhighlighted `<pre><code>` fallback, matching marked's default output.
 * Reimplemented rather than delegated so every block, highlighted or not, gets
 * the same wrapper and therefore the same copy button.
 */
function plainCodeBlock(token: Tokens.Code): string {
  const lang = token.lang?.trim().split(/\s+/)[0] ?? '';
  const className = `language-${lang}`;
  const classAttr = LANGUAGE_CLASS_PATTERN.test(className)
    ? ` class="${className}"`
    : '';
  // Matching marked's own trailing-newline handling: an indented block keeps
  // its final newline in the token, so emitting one unconditionally leaves a
  // blank line that the copy button then copies.
  const text = escapeHtml(token.text.replace(/\n$/, ''));
  return `<pre><code${classAttr}>${text}\n</code></pre>`;
}

/**
 * Builds a parser for a single document. The instance is per-call because the
 * heading slugger carries state, and sharing it across documents would number
 * a heading based on what some earlier page happened to contain.
 */
function createParser(): Marked {
  const usedIds = new Set<string>();
  // Highlighting is async but marked's renderers are not, so walkTokens does the
  // work up front and parks it here for the sync `code` renderer. The key type is
  // a union because walkTokens narrows a code token only as far as Code | Generic.
  const highlighted = new WeakMap<Tokens.Code | Tokens.Generic, string>();

  return new Marked({
    async: true,
    async walkTokens(token) {
      if (token.type !== 'code') return;
      const html = await highlightCode(token.text, token.lang);
      if (html) highlighted.set(token, html);
    },
    renderer: {
      code(token) {
        const inner = highlighted.get(token) ?? plainCodeBlock(token);
        return `<div class="${CODE_BLOCK_CLASS}">${inner}</div>`;
      },
      heading({ tokens, depth }) {
        // Slug the plain text, not the rendered inline HTML: otherwise a
        // heading containing code or a link folds tag names into its id
        // (`## Run \`pnpm index\`` became `run-codepnpm-indexcode`).
        const plain = this.parser.parseInline(tokens, this.parser.textRenderer);
        // A heading of only punctuation or emoji slugs to nothing; it still
        // needs an id for the table of contents to link it.
        const base = slugify(plain) || 'section';
        let id = base;
        for (let n = 1; usedIds.has(id); n++) {
          id = `${base}-${n}`;
        }
        usedIds.add(id);
        const text = this.parser.parseInline(tokens);
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const safeHref = isSafeUrl(href, SAFE_LINK_SCHEMES) ? href : '';
        const escapedHref = escapeHtml(safeHref);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        if (safeHref.startsWith('http://') || safeHref.startsWith('https://')) {
          return `<a href="${escapedHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return `<a href="${escapedHref}"${titleAttr}>${text}</a>`;
      },
      image({ href, title, text }) {
        const escapedAlt = escapeHtml(text || 'Image');
        const safeHref = isSafeUrl(href, SAFE_IMAGE_SCHEMES) ? href : '';
        const escapedHref = escapeHtml(safeHref);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        // Add decoding="async" for non-blocking decode, loading="lazy" for lazy load
        // Width/height omitted as markdown doesn't provide dimensions - use CSS for sizing
        return `<img src="${escapedHref}" alt="${escapedAlt}"${titleAttr} loading="lazy" decoding="async" />`;
      },
    },
  });
}

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
    img: ['src', 'alt', 'title', 'loading', 'decoding', 'width', 'height'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
  },
  // `class` is carried by allowedClasses rather than allowedAttributes: an
  // allowlisted tag keeps only the class names named here and loses the rest.
  allowedClasses: {
    div: [CODE_BLOCK_CLASS],
    pre: [CODE_PRE_CLASS],
    code: [LANGUAGE_CLASS_PATTERN],
    span: [CODE_LINE_CLASS, ...SYNTAX_TOKEN_CLASSES],
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
  const html = await createParser().parse(content);
  return sanitizeHtml(html, sanitizeOptions);
}

export { marked };
