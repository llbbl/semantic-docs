import { describe, expect, it, vi } from 'vitest';
import {
  defaultTheme,
  themeColorCssVariable,
  themeColorVariables,
  themeNames,
  themePrepaintScript,
  themes,
} from './themes';

function runPrepaintScript(options: {
  getItem?: () => string | null;
  throwOnGetItem?: boolean;
}) {
  const properties = new Map<string, string>();
  const document = {
    documentElement: {
      style: {
        setProperty: vi.fn((key: string, value: string) => {
          properties.set(key, value);
        }),
      },
    },
  };
  const localStorage = {
    getItem: vi.fn(() => {
      if (options.throwOnGetItem) throw new Error('storage unavailable');
      return options.getItem?.() ?? null;
    }),
  };

  Function(
    'document',
    'localStorage',
    themePrepaintScript,
  )(document, localStorage);

  return { properties };
}

describe('themeColorCssVariable', () => {
  it.each([
    ['background', '--background'],
    ['cardForeground', '--card-foreground'],
    ['sidebarPrimaryForeground', '--sidebar-primary-foreground'],
  ])('maps %s to %s', (key, expected) => {
    expect(themeColorCssVariable(key)).toBe(expected);
  });
});

describe('theme color prepaint configuration', () => {
  it('maps every configured color token to its runtime CSS variable', () => {
    for (const theme of themes) {
      expect(Object.keys(themeColorVariables[theme.name]).sort()).toEqual(
        Object.keys(theme.colors).map(themeColorCssVariable).sort(),
      );
    }
  });

  it('covers every declared theme name', () => {
    // themes, themeNames and the ThemeName union are three separate lists
    // that can drift; a union member missing from themes is undefined at runtime.
    expect(Object.keys(themeColorVariables).sort()).toEqual(
      [...themeNames].sort(),
    );
  });

  it('escapes < so a color value cannot terminate the script element', () => {
    expect(themePrepaintScript).not.toContain('</');
  });

  it.each(['--border', '--header-border', '--sidebar-border', '--toc-border'])(
    'carries %s, which global.css otherwise leaves at its light :root value',
    (variable) => {
      for (const theme of themes) {
        expect(themeColorVariables[theme.name][variable]).toBeTruthy();
      }
    },
  );

  it('applies the saved theme token set before paint', () => {
    const { properties } = runPrepaintScript({ getItem: () => 'ocean' });

    expect(Object.fromEntries(properties)).toEqual(themeColorVariables.ocean);
  });

  it.each([
    ['missing', null],
    ['invalid', 'unknown-theme'],
    ['prototype property', '__proto__'],
    ['constructor property', 'constructor'],
  ])(
    'falls back to the default theme when localStorage is %s',
    (_label, value) => {
      const { properties } = runPrepaintScript({ getItem: () => value });

      expect(Object.fromEntries(properties)).toEqual(
        themeColorVariables[defaultTheme],
      );
    },
  );

  it('uses the default theme when localStorage access fails', () => {
    expect(() => runPrepaintScript({ throwOnGetItem: true })).not.toThrow();
    const { properties } = runPrepaintScript({ throwOnGetItem: true });

    expect(Object.fromEntries(properties)).toEqual(
      themeColorVariables[defaultTheme],
    );
  });
});
