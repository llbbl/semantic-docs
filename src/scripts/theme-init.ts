/**
 * Initialize theme on page load
 * This runs before the page renders to prevent flash
 */

import { defaultTheme, themes } from '../config/themes';

const savedTheme = localStorage.getItem('theme') || defaultTheme;
const theme = themes.find((t) => t.name === savedTheme);

if (theme) {
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });
}
