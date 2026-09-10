import { createHash } from 'node:crypto';
import { themePrepaintScript } from './themes';

// Kept out of themes.ts because ThemeSwitcher.tsx pulls that module into the
// client bundle, which cannot resolve node:crypto.

/**
 * CSP hash source authorizing the inline theme prepaint script. Derived from
 * the script text, so a themes.ts edit cannot leave behind a stale digest that
 * would block first paint on every page.
 */
export const themePrepaintScriptHash: `sha256-${string}` = `sha256-${createHash(
  'sha256',
)
  .update(themePrepaintScript, 'utf8')
  .digest('base64')}`;
