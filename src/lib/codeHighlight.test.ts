import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { logger } from 'logan-logger';
import { describe, expect, it, vi } from 'vitest';
import {
  CODE_LINE_CLASS,
  CODE_PRE_CLASS,
  createStyleToClassTransformer,
  highlightCode,
  isSupportedLanguage,
  SYNTAX_TOKEN_CLASSES,
} from './codeHighlight';

function classNamesIn(html: string): string[] {
  return [...html.matchAll(/class="([^"]*)"/g)].flatMap((match) =>
    (match[1] ?? '').split(/\s+/).filter(Boolean),
  );
}

describe('isSupportedLanguage', () => {
  it('should accept bundled grammar names', () => {
    expect(isSupportedLanguage('typescript')).toBe(true);
    expect(isSupportedLanguage('python')).toBe(true);
  });

  it('should accept grammar aliases', () => {
    expect(isSupportedLanguage('ts')).toBe(true);
    expect(isSupportedLanguage('js')).toBe(true);
    expect(isSupportedLanguage('sh')).toBe(true);
    expect(isSupportedLanguage('md')).toBe(true);
  });

  it('should normalize case and surrounding whitespace', () => {
    expect(isSupportedLanguage('  TypeScript ')).toBe(true);
  });

  it('should reject unbundled languages', () => {
    expect(isSupportedLanguage('brainfuck')).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
  });
});

describe('highlightCode', () => {
  it('should return null when no language is given', async () => {
    expect(await highlightCode('const a = 1;', undefined)).toBeNull();
    expect(await highlightCode('const a = 1;', '   ')).toBeNull();
  });

  it('should return null for an unbundled language', async () => {
    expect(await highlightCode('x', 'brainfuck')).toBeNull();
  });

  it('should emit token classes rather than inline styles', async () => {
    const html = await highlightCode('const x = 1; // note', 'ts');
    expect(html).not.toBeNull();
    expect(html).not.toMatch(/style=/);
    expect(html).toContain('class="sh-keyword"');
    expect(html).toContain('class="sh-comment"');
  });

  it('should tag the code element with its language', async () => {
    const html = await highlightCode('SELECT 1;', 'sql');
    expect(html).toContain('<code class="language-sql">');
  });

  it('should drop the tabindex and background style Shiki adds to pre', async () => {
    const html = await highlightCode('const a = 1;', 'ts');
    expect(html).toContain('<pre class="shiki">');
    expect(html).not.toContain('tabindex');
  });

  it('should escape HTML in the highlighted source', async () => {
    const html = await highlightCode(
      'const s = "<script>alert(1)</script>";',
      'ts',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&#x3C;script>');
  });

  // The sanitizer allowlist is built from SYNTAX_TOKEN_CLASSES, so a class the
  // transformer can emit but the list omits would be silently stripped.
  it('should only emit classes covered by the sanitizer allowlist', async () => {
    const allowed = new Set<string>([
      'shiki',
      CODE_LINE_CLASS,
      ...SYNTAX_TOKEN_CLASSES,
    ]);
    const samples: Array<[string, string]> = [
      ['typescript', `const f = (a: number) => \`v=\${a}\`; // c`],
      ['python', 'def f(a):\n    return f"v={a}"  # c'],
      ['markdown', '# h\n\n*em* and **strong** and [l](https://e.com)'],
      ['bash', 'echo "hi" # c'],
      ['json', '{ "a": [1, true, null] }'],
      ['css', '.a { color: red; /* c */ }'],
      ['html', '<div class="a">x</div>'],
      ['go', 'func main() { println("hi") }'],
      ['rust', 'fn main() { println!("hi"); }'],
      ['yaml', 'a: 1 # c'],
      ['diff', '+ added\n- removed'],
      ['astro', '---\nconst a = 1;\n---\n<p>{a}</p>'],
    ];

    for (const [lang, code] of samples) {
      const html = await highlightCode(code, lang);
      expect(html, `expected ${lang} to highlight`).not.toBeNull();
      for (const name of classNamesIn(html ?? '')) {
        if (name.startsWith('language-')) continue;
        expect(allowed, `unexpected class "${name}" from ${lang}`).toContain(
          name,
        );
      }

      // A variable missing from the class table yields bare spans, which the
      // allowlist check above accepts happily.
      const tokenClasses = classNamesIn(html ?? '').filter(
        (name) =>
          name !== CODE_LINE_CLASS &&
          name !== CODE_PRE_CLASS &&
          !name.startsWith('language-'),
      );
      expect(
        tokenClasses,
        `${lang} produced no token classes`,
      ).not.toHaveLength(0);
    }
  });

  // The stylesheet is hand-authored and is the one half of the pipeline that
  // does not derive from SYNTAX_TOKEN_CLASSES, so it can fall behind silently.
  it('should have a style rule for every token class', async () => {
    const css = await readFile(
      resolve(process.cwd(), './src/pages/content/[...slug].astro'),
      'utf8',
    );

    for (const name of SYNTAX_TOKEN_CLASSES) {
      expect(css, `no style rule for .${name}`).toContain(`:global(.${name})`);
    }
  });
});

describe('style-to-class transformer', () => {
  function spanNode(style: string) {
    return {
      type: 'element' as const,
      tagName: 'span' as const,
      properties: { style } as Record<string, unknown>,
      children: [],
    };
  }

  // The real handler signature carries line, column and token arguments this
  // one never reads, so the node is all a caller needs to supply.
  type SpanHandler = (node: { properties: Record<string, unknown> }) => void;

  function applySpan(style: string) {
    const transformer = createStyleToClassTransformer();
    const node = spanNode(style);
    (transformer.span as unknown as SpanHandler).call(transformer, node);
    return node.properties;
  }

  it('maps a known token variable to its class and drops the style', () => {
    expect(applySpan('color:var(--shiki-token-keyword)')).toEqual({
      style: undefined,
      class: 'sh-keyword',
    });
  });

  // A Shiki release that adds a token variable must fail to unstyled text
  // rather than leaking an inline style past a strict style-src.
  it('drops an unmapped token variable rather than emitting a style', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const properties = applySpan('color:var(--shiki-token-invented)');

    expect(properties.style).toBeUndefined();
    expect(properties.class).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unmapped Shiki token variable'),
      expect.objectContaining({ variable: '--shiki-token-invented' }),
    );
    warn.mockRestore();
  });

  it('leaves a span with no style untouched', () => {
    const transformer = createStyleToClassTransformer();
    const node = {
      type: 'element' as const,
      tagName: 'span' as const,
      properties: {} as Record<string, unknown>,
      children: [],
    };
    (transformer.span as unknown as SpanHandler).call(transformer, node);

    expect(node.properties.class).toBeUndefined();
  });
});
