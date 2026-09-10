/**
 * Theme Configuration
 * Define custom color themes here
 *
 * CSS Variable Naming Convention:
 * Color keys use camelCase here (e.g., cardForeground, sidebarPrimary).
 * ThemeSwitcher.tsx converts these to kebab-case CSS variables:
 *   cardForeground -> --card-foreground
 *   sidebarPrimary -> --sidebar-primary
 *
 * These must match the CSS variable names used in global.css and Tailwind config.
 */

/** Theme name type - explicit union for type safety */
export type ThemeName =
  | 'dark'
  | 'light'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'purple';

export interface Theme {
  name: ThemeName;
  label: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    header: string;
    headerForeground: string;
    headerBorder: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    sidebarRing: string;
    toc: string;
    tocForeground: string;
    tocBorder: string;
    // Syntax token colors. These ride the same variable pipeline as every other
    // token, which is what lets a build-time-highlighted page restyle itself on
    // a theme switch without being re-highlighted.
    syntaxComment: string;
    syntaxKeyword: string;
    syntaxString: string;
    syntaxStringExpression: string;
    syntaxConstant: string;
    syntaxFunction: string;
    syntaxParameter: string;
    syntaxPunctuation: string;
    syntaxLink: string;
    syntaxInserted: string;
    syntaxDeleted: string;
    syntaxChanged: string;
  };
}

export const themes: Theme[] = [
  {
    name: 'dark',
    label: 'Dark',
    colors: {
      background: '#1a1a1a',
      foreground: '#fafafa',
      card: '#1a1a1a',
      cardForeground: '#fafafa',
      popover: '#1a1a1a',
      popoverForeground: '#fafafa',
      primary: '#fafafa',
      primaryForeground: '#1a1a1a',
      secondary: '#262626',
      secondaryForeground: '#fafafa',
      muted: '#262626',
      mutedForeground: '#a1a1a1',
      accent: '#262626',
      accentForeground: '#fafafa',
      destructive: '#7f1d1d',
      destructiveForeground: '#fca5a5',
      border: '#262626',
      input: '#262626',
      ring: '#525252',
      header: '#141414',
      headerForeground: '#fafafa',
      headerBorder: '#262626',
      sidebar: '#0f0f0f',
      sidebarForeground: '#fafafa',
      sidebarPrimary: '#6366f1',
      sidebarPrimaryForeground: '#fafafa',
      sidebarAccent: '#1a1a1a',
      sidebarAccentForeground: '#fafafa',
      sidebarBorder: '#1a1a1a',
      sidebarRing: '#525252',
      toc: '#262626',
      tocForeground: '#fafafa',
      tocBorder: '#1a1a1a',
      syntaxComment: '#8b949e',
      syntaxKeyword: '#ff7b72',
      syntaxString: '#a5d6ff',
      syntaxStringExpression: '#a5d6ff',
      syntaxConstant: '#79c0ff',
      syntaxFunction: '#d2a8ff',
      syntaxParameter: '#ffa657',
      syntaxPunctuation: '#c9d1d9',
      syntaxLink: '#79c0ff',
      syntaxInserted: '#3fb950',
      syntaxDeleted: '#f85149',
      syntaxChanged: '#d29922',
    },
  },
  {
    name: 'light',
    label: 'Light',
    colors: {
      background: '#ffffff',
      foreground: '#171717',
      card: '#ffffff',
      cardForeground: '#171717',
      popover: '#ffffff',
      popoverForeground: '#171717',
      primary: '#171717',
      primaryForeground: '#fafafa',
      secondary: '#f5f5f5',
      secondaryForeground: '#171717',
      muted: '#f5f5f5',
      mutedForeground: '#737373',
      accent: '#f5f5f5',
      accentForeground: '#171717',
      destructive: '#dc2626',
      destructiveForeground: '#fef2f2',
      border: '#e5e5e5',
      input: '#e5e5e5',
      ring: '#a3a3a3',
      header: '#f5f5f5',
      headerForeground: '#171717',
      headerBorder: '#e5e5e5',
      sidebar: '#f9fafb',
      sidebarForeground: '#171717',
      sidebarPrimary: '#171717',
      sidebarPrimaryForeground: '#fafafa',
      sidebarAccent: '#f5f5f5',
      sidebarAccentForeground: '#171717',
      sidebarBorder: '#e5e7eb',
      sidebarRing: '#a3a3a3',
      toc: '#fafafa',
      tocForeground: '#171717',
      tocBorder: '#e5e7eb',
      syntaxComment: '#6e7781',
      syntaxKeyword: '#cf222e',
      syntaxString: '#0a3069',
      syntaxStringExpression: '#0a3069',
      syntaxConstant: '#0550ae',
      syntaxFunction: '#8250df',
      syntaxParameter: '#953800',
      syntaxPunctuation: '#24292f',
      syntaxLink: '#0550ae',
      syntaxInserted: '#1a7f37',
      syntaxDeleted: '#cf222e',
      syntaxChanged: '#9a6700',
    },
  },
  {
    name: 'ocean',
    label: 'Ocean',
    colors: {
      background: '#0a1628',
      foreground: '#e0f2fe',
      card: '#0a1628',
      cardForeground: '#e0f2fe',
      popover: '#0a1628',
      popoverForeground: '#e0f2fe',
      primary: '#0ea5e9',
      primaryForeground: '#ffffff',
      secondary: '#1e3a5f',
      secondaryForeground: '#e0f2fe',
      muted: '#1e3a5f',
      mutedForeground: '#7dd3fc',
      accent: '#164e63',
      accentForeground: '#e0f2fe',
      destructive: '#dc2626',
      destructiveForeground: '#fee2e2',
      border: '#1e3a5f',
      input: '#1e3a5f',
      ring: '#0ea5e9',
      header: '#0a1a2e',
      headerForeground: '#e0f2fe',
      headerBorder: '#1e3a5f',
      sidebar: '#071220',
      sidebarForeground: '#e0f2fe',
      sidebarPrimary: '#0ea5e9',
      sidebarPrimaryForeground: '#ffffff',
      sidebarAccent: '#1e3a5f',
      sidebarAccentForeground: '#e0f2fe',
      sidebarBorder: '#0c1e35',
      sidebarRing: '#0ea5e9',
      toc: '#0f2942',
      tocForeground: '#e0f2fe',
      tocBorder: '#1e3a5f',
      syntaxComment: '#7f9cb8',
      syntaxKeyword: '#38bdf8',
      syntaxString: '#5eead4',
      syntaxStringExpression: '#5eead4',
      syntaxConstant: '#a5b4fc',
      syntaxFunction: '#67e8f9',
      syntaxParameter: '#fbbf24',
      syntaxPunctuation: '#bae6fd',
      syntaxLink: '#38bdf8',
      syntaxInserted: '#2dd4bf',
      syntaxDeleted: '#f87171',
      syntaxChanged: '#fbbf24',
    },
  },
  {
    name: 'forest',
    label: 'Forest',
    colors: {
      background: '#0f1e13',
      foreground: '#d1fae5',
      card: '#0f1e13',
      cardForeground: '#d1fae5',
      popover: '#0f1e13',
      popoverForeground: '#d1fae5',
      primary: '#10b981',
      primaryForeground: '#ffffff',
      secondary: '#1a3d23',
      secondaryForeground: '#d1fae5',
      muted: '#1a3d23',
      mutedForeground: '#6ee7b7',
      accent: '#065f46',
      accentForeground: '#d1fae5',
      destructive: '#dc2626',
      destructiveForeground: '#fee2e2',
      border: '#1a3d23',
      input: '#1a3d23',
      ring: '#10b981',
      header: '#0d1a11',
      headerForeground: '#d1fae5',
      headerBorder: '#1a3d23',
      sidebar: '#0a140d',
      sidebarForeground: '#d1fae5',
      sidebarPrimary: '#10b981',
      sidebarPrimaryForeground: '#ffffff',
      sidebarAccent: '#1a3d23',
      sidebarAccentForeground: '#d1fae5',
      sidebarBorder: '#0f1e13',
      sidebarRing: '#10b981',
      toc: '#14291a',
      tocForeground: '#d1fae5',
      tocBorder: '#1a3d23',
      syntaxComment: '#7f9e88',
      syntaxKeyword: '#34d399',
      syntaxString: '#bef264',
      syntaxStringExpression: '#bef264',
      syntaxConstant: '#86efac',
      syntaxFunction: '#5eead4',
      syntaxParameter: '#fcd34d',
      syntaxPunctuation: '#a7f3d0',
      syntaxLink: '#34d399',
      syntaxInserted: '#4ade80',
      syntaxDeleted: '#f87171',
      syntaxChanged: '#fbbf24',
    },
  },
  {
    name: 'sunset',
    label: 'Sunset',
    colors: {
      background: '#1c0f0a',
      foreground: '#fef3c7',
      card: '#1c0f0a',
      cardForeground: '#fef3c7',
      popover: '#1c0f0a',
      popoverForeground: '#fef3c7',
      primary: '#f97316',
      primaryForeground: '#ffffff',
      secondary: '#3d1f15',
      secondaryForeground: '#fef3c7',
      muted: '#3d1f15',
      mutedForeground: '#fcd34d',
      accent: '#7c2d12',
      accentForeground: '#fef3c7',
      destructive: '#dc2626',
      destructiveForeground: '#fee2e2',
      border: '#3d1f15',
      input: '#3d1f15',
      ring: '#f97316',
      header: '#1a0d08',
      headerForeground: '#fef3c7',
      headerBorder: '#3d1f15',
      sidebar: '#110a07',
      sidebarForeground: '#fef3c7',
      sidebarPrimary: '#f97316',
      sidebarPrimaryForeground: '#ffffff',
      sidebarAccent: '#3d1f15',
      sidebarAccentForeground: '#fef3c7',
      sidebarBorder: '#1c0f0a',
      sidebarRing: '#f97316',
      toc: '#2a1510',
      tocForeground: '#fef3c7',
      tocBorder: '#3d1f15',
      syntaxComment: '#b08968',
      syntaxKeyword: '#fb923c',
      syntaxString: '#fde68a',
      syntaxStringExpression: '#fde68a',
      syntaxConstant: '#fca5a5',
      syntaxFunction: '#fcd34d',
      syntaxParameter: '#f9a8d4',
      syntaxPunctuation: '#fed7aa',
      syntaxLink: '#fb923c',
      syntaxInserted: '#84cc16',
      syntaxDeleted: '#ef4444',
      syntaxChanged: '#fbbf24',
    },
  },
  {
    name: 'purple',
    label: 'Purple',
    colors: {
      background: '#1a0a1f',
      foreground: '#f3e8ff',
      card: '#1a0a1f',
      cardForeground: '#f3e8ff',
      popover: '#1a0a1f',
      popoverForeground: '#f3e8ff',
      primary: '#a855f7',
      primaryForeground: '#ffffff',
      secondary: '#2e1a3d',
      secondaryForeground: '#f3e8ff',
      muted: '#2e1a3d',
      mutedForeground: '#d8b4fe',
      accent: '#581c87',
      accentForeground: '#f3e8ff',
      destructive: '#dc2626',
      destructiveForeground: '#fee2e2',
      border: '#2e1a3d',
      input: '#2e1a3d',
      ring: '#a855f7',
      header: '#15091c',
      headerForeground: '#f3e8ff',
      headerBorder: '#2e1a3d',
      sidebar: '#0f0514',
      sidebarForeground: '#f3e8ff',
      sidebarPrimary: '#a855f7',
      sidebarPrimaryForeground: '#ffffff',
      sidebarAccent: '#2e1a3d',
      sidebarAccentForeground: '#f3e8ff',
      sidebarBorder: '#1a0a1f',
      sidebarRing: '#a855f7',
      toc: '#241129',
      tocForeground: '#f3e8ff',
      tocBorder: '#2e1a3d',
      syntaxComment: '#a78bb9',
      syntaxKeyword: '#c084fc',
      syntaxString: '#f0abfc',
      syntaxStringExpression: '#f0abfc',
      syntaxConstant: '#d8b4fe',
      syntaxFunction: '#a5b4fc',
      syntaxParameter: '#fcd34d',
      syntaxPunctuation: '#e9d5ff',
      syntaxLink: '#c084fc',
      syntaxInserted: '#4ade80',
      syntaxDeleted: '#f472b6',
      syntaxChanged: '#fbbf24',
    },
  },
];

/** List of all available theme names for runtime validation */
export const themeNames: ThemeName[] = [
  'dark',
  'light',
  'ocean',
  'forest',
  'sunset',
  'purple',
];

export const defaultTheme: ThemeName = 'dark';

/** camelCase color key to its CSS custom property (cardForeground -> --card-foreground). */
export function themeColorCssVariable(key: string): string {
  return `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/** Every theme's complete token set, keyed by CSS variable name. */
export const themeColorVariables: Record<
  ThemeName,
  Record<string, string>
> = Object.fromEntries(
  themes.map((theme) => [
    theme.name,
    Object.fromEntries(
      Object.entries(theme.colors).map(([key, value]) => [
        themeColorCssVariable(key),
        value,
      ]),
    ),
  ]),
) as Record<ThemeName, Record<string, string>>;

// Runs inline in <head> before first paint. A partial token set leaves the
// remaining variables at global.css's light-mode :root values, which is what
// made borders flash white on navigation.
// JSON.stringify leaves "/" alone, so an unescaped "</script>" in a color value
// would terminate the inline script element. The < escape is the same
// character to the JS parser but inert to the HTML tokenizer.
export const themePrepaintScript = `(function(){try{var m=${JSON.stringify(
  themeColorVariables,
).replace(
  /</g,
  '\\u003c',
)},d='${defaultTheme}',t;try{t=localStorage.getItem('theme')}catch(e){}var c=Object.prototype.hasOwnProperty.call(m,t)?m[t]:m[d],s=document.documentElement.style;for(var k in c){s.setProperty(k,c[k])}}catch(e){}})();`;
