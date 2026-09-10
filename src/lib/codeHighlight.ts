import astro from '@shikijs/langs/astro';
import bash from '@shikijs/langs/bash';
import css from '@shikijs/langs/css';
import diff from '@shikijs/langs/diff';
import go from '@shikijs/langs/go';
import html from '@shikijs/langs/html';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import jsx from '@shikijs/langs/jsx';
import markdown from '@shikijs/langs/markdown';
import python from '@shikijs/langs/python';
import rust from '@shikijs/langs/rust';
import sql from '@shikijs/langs/sql';
import tsx from '@shikijs/langs/tsx';
import typescript from '@shikijs/langs/typescript';
import yaml from '@shikijs/langs/yaml';
import { logger } from 'logan-logger';
import type {
  HighlighterCore,
  LanguageRegistration,
  ShikiTransformer,
} from 'shiki/core';
import { createCssVariablesTheme, createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';

const THEME_NAME = 'semantic-docs-vars';

// Grammar set is deliberately small. Each entry is a static import, so anything
// added here is loaded into every build whether or not the content uses it.
const LANGUAGE_BUNDLES: LanguageRegistration[][] = [
  astro,
  bash,
  css,
  diff,
  go,
  html,
  javascript,
  json,
  jsx,
  markdown,
  python,
  rust,
  sql,
  tsx,
  typescript,
  yaml,
];

/** Every grammar name and alias the highlighter can resolve, including embedded ones. */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set(
  LANGUAGE_BUNDLES.flatMap((bundle) =>
    bundle.flatMap((registration) => [
      registration.name,
      ...(registration.aliases ?? []),
    ]),
  ),
);

// The css-variables theme resolves every token colour to one of these
// variables, which is what makes a static style-to-class table possible. The
// three diff tokens are the whole `diff` grammar; omitting one renders that
// language's output entirely unstyled rather than failing.
const TOKEN_CLASS_BY_VARIABLE: Readonly<Record<string, string>> = {
  '--shiki-foreground': 'sh-text',
  '--shiki-token-changed': 'sh-changed',
  '--shiki-token-comment': 'sh-comment',
  '--shiki-token-constant': 'sh-constant',
  '--shiki-token-deleted': 'sh-deleted',
  '--shiki-token-function': 'sh-function',
  '--shiki-token-inserted': 'sh-inserted',
  '--shiki-token-keyword': 'sh-keyword',
  '--shiki-token-link': 'sh-link',
  '--shiki-token-parameter': 'sh-parameter',
  '--shiki-token-punctuation': 'sh-punctuation',
  '--shiki-token-string': 'sh-string',
  '--shiki-token-string-expression': 'sh-string-expression',
};

const FONT_CLASS_BY_DECLARATION: Readonly<Record<string, string>> = {
  'font-style:italic': 'sh-italic',
  'font-weight:bold': 'sh-bold',
  'text-decoration:underline': 'sh-underline',
};

/** Token classes the stylesheet defines and the sanitizer allows on `span`. */
export const SYNTAX_TOKEN_CLASSES: readonly string[] = [
  ...Object.values(TOKEN_CLASS_BY_VARIABLE),
  ...Object.values(FONT_CLASS_BY_DECLARATION),
];

export const CODE_BLOCK_CLASS = 'code-block';
export const CODE_PRE_CLASS = 'shiki';
export const CODE_LINE_CLASS = 'line';

/** Class names produced from a single CSS declaration, or null if unrecognised. */
function declarationToClass(declaration: string): string | null {
  const compact = declaration.replace(/\s+/g, '');
  const fontClass = FONT_CLASS_BY_DECLARATION[compact];
  if (fontClass) return fontClass;

  const match = /^color:var\((--shiki-[a-z-]+)\)$/.exec(compact);
  if (!match?.[1]) return null;

  const tokenClass = TOKEN_CLASS_BY_VARIABLE[match[1]];
  if (!tokenClass) {
    // A Shiki release that adds a token variable would otherwise render that
    // token unstyled with nothing to notice at build time.
    logger.warn('Unmapped Shiki token variable, rendering unstyled', {
      variable: match[1],
    });
    return null;
  }
  return tokenClass;
}

/**
 * Rewrites Shiki's inline `style` attributes as classes so a `style-src` with no
 * 'unsafe-inline' can serve the page. Class names are fixed rather than derived
 * from the style text, so the matching CSS can live in a static stylesheet.
 */
function createStyleToClassTransformer(): ShikiTransformer {
  return {
    name: 'semantic-docs:style-to-class',
    pre(node) {
      node.properties = { class: CODE_PRE_CLASS };
    },
    code(node) {
      const lang = this.options.lang;
      node.properties = { class: `language-${lang}` };
    },
    span(node) {
      const style = node.properties.style;
      node.properties.style = undefined;
      if (typeof style !== 'string') return;

      const classes = style
        .split(';')
        .map(declarationToClass)
        .filter((name): name is string => name !== null);
      if (classes.length > 0) node.properties.class = classes.join(' ');
    },
  };
}

const styleToClassTransformer = createStyleToClassTransformer();

let highlighterPromise: Promise<HighlighterCore> | null = null;

/**
 * Grammar and WASM loading costs a second or so, so the highlighter is built
 * once per process and shared by every code block in the build.
 */
function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [createCssVariablesTheme({ name: THEME_NAME, fontStyle: true })],
    langs: LANGUAGE_BUNDLES,
    engine: createOnigurumaEngine(import('shiki/wasm')),
  });
  return highlighterPromise;
}

export function isSupportedLanguage(lang: string): boolean {
  return SUPPORTED_LANGUAGES.has(normalizeLanguage(lang));
}

function normalizeLanguage(lang: string): string {
  return lang.trim().toLowerCase().split(/\s+/)[0] ?? '';
}

/**
 * Highlighted `<pre>` markup for a fenced block, or null when the language is
 * absent or unbundled so the caller can fall back to plain rendering.
 */
export async function highlightCode(
  code: string,
  lang: string | undefined,
): Promise<string | null> {
  const normalized = normalizeLanguage(lang ?? '');
  if (!normalized || !SUPPORTED_LANGUAGES.has(normalized)) return null;

  try {
    const highlighter = await getHighlighter();
    return highlighter.codeToHtml(code, {
      lang: normalized,
      theme: THEME_NAME,
      transformers: [styleToClassTransformer],
    });
  } catch (error) {
    logger.warn('Syntax highlighting failed, rendering plain code block', {
      lang: normalized,
      error,
    });
    return null;
  }
}
