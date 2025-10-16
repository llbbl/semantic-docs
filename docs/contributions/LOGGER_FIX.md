# @logan/logger - Client-Side Bundling Issue

## Problem

When using `@logan/logger` in client-side React components within an Astro project, the build fails with esbuild loader errors for `.map` files:

```
Error: Build failed with 4 errors:
node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/config.js:107:53: ERROR: No loader is configured for ".map" files: node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/config.js.map
node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/config.js:107:53: ERROR: No loader is configured for ".map" files: node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/formatting.js.map
node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/config.js:107:53: ERROR: No loader is configured for ".map" files: node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/runtime.js.map
node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/config.js:107:53: ERROR: No loader is configured for ".map" files: node_modules/.pnpm/@jsr+logan__logger@1.1.11/node_modules/@jsr/logan__logger/src/utils/serialization.js.map
```

## Current Status

- **Server-side usage**: ✅ Works perfectly in Astro pages, API routes, and Node.js scripts
- **Client-side usage**: ❌ Fails during build when imported in React components

## Reproduction

1. Create an Astro project with React components
2. Install `@logan/logger` from JSR
3. Import logger in a client-side React component:

```tsx
// src/components/Search.tsx
import { logger } from '@logan/logger';
import { useCallback, useState } from 'react';

export default function Search() {
  const handleError = (err: Error) => {
    logger.error('Search error:', err); // This causes build to fail
  };

  // ... rest of component
}
```

4. Run `pnpm build` (or `npm run build`)
5. Build fails with esbuild loader errors for `.map` files

## Root Cause Analysis

### Why It Happens

The issue occurs because:

1. **Source maps are being imported as modules**: The library's compiled JavaScript files are trying to import their corresponding `.map` files
2. **esbuild has no loader for `.map` files**: When bundling for the browser, esbuild encounters these imports and doesn't know how to handle them
3. **Source map references in JS files**: The compiled JS files likely contain lines like:
   ```javascript
   //# sourceMappingURL=config.js.map
   ```
   Or potentially direct imports of the map files

### Files Affected

- `src/utils/config.js` / `config.js.map`
- `src/utils/formatting.js` / `formatting.js.map`
- `src/utils/runtime.js` / `runtime.js.map`
- `src/utils/serialization.js` / `serialization.js.map`

## Potential Solutions

### Solution 1: Remove Source Maps from Distribution (Recommended)

**Change the build process to exclude source maps from the published package.**

**In the logger package:**

1. Update `deno.json` or build configuration to not generate source maps:

```json
{
  "compilerOptions": {
    "sourceMap": false
  }
}
```

Or if using a bundler, add `.map` files to `.npmignore` or `.gitignore`:

```
# .npmignore
*.map
**/*.map
```

2. Alternatively, ensure source maps are inline rather than separate files:

```json
{
  "compilerOptions": {
    "inlineSourceMap": true,
    "sourceMap": false
  }
}
```

**Pros:**
- Simple fix, no code changes needed
- Reduces package size
- Source maps not typically needed in production dependencies

**Cons:**
- Loses source map debugging for library users
- May make debugging library issues harder

### Solution 2: Conditional Exports for Browser vs Node

**Create separate entry points for browser and Node.js environments.**

**Package structure:**

```json
{
  "name": "@logan/logger",
  "exports": {
    ".": {
      "browser": "./dist/browser.js",
      "node": "./dist/node.js",
      "default": "./dist/node.js"
    }
  }
}
```

**Create `src/browser.ts`:**

```typescript
// Lightweight browser-specific implementation
export const logger = {
  info: (...args: any[]) => console.info('[Logger]', ...args),
  warn: (...args: any[]) => console.warn('[Logger]', ...args),
  error: (...args: any[]) => console.error('[Logger]', ...args),
  debug: (...args: any[]) => console.debug('[Logger]', ...args),
};
```

**Keep full implementation in `src/node.ts`** with Winston support, etc.

**Pros:**
- Optimized bundle for each environment
- Smaller browser bundle
- No Winston dependency in browser

**Cons:**
- Requires maintaining two implementations
- More complex build process

### Solution 3: Fix Source Map References

**Ensure source map references don't cause import errors.**

The issue might be that the compiled JS files have source map references that bundlers interpret as module imports. Fix by:

1. Ensuring source map comments use the correct format:
   ```javascript
   //# sourceMappingURL=config.js.map
   ```
   Not:
   ```javascript
   import 'config.js.map'; // Wrong!
   ```

2. Check the transpilation output to ensure source maps are referenced, not imported

**In the build script:**

```typescript
// After transpilation, verify source map comments
const content = await Deno.readTextFile('dist/config.js');
if (content.includes("import '") && content.includes(".map'")) {
  throw new Error('Source maps should be referenced, not imported');
}
```

### Solution 4: Add `.map` Files to package.json exports

**If you want to keep source maps, explicitly declare them:**

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./*.map": "./dist/*.map"
  },
  "files": [
    "dist/**/*.js",
    "dist/**/*.d.ts",
    "dist/**/*.map"
  ]
}
```

**Pros:**
- Keeps source maps for debugging
- Makes them explicitly available

**Cons:**
- Doesn't solve the esbuild loader issue
- Bundlers still may not know how to handle them

## Recommended Approach

**For @logan/logger, I recommend Solution 1 + Solution 2 combined:**

1. **Short-term fix**: Remove source maps from the published package
2. **Long-term improvement**: Create browser-optimized build

### Implementation Steps

#### Step 1: Remove Source Maps (Immediate Fix)

**In `deno.json`:**

```json
{
  "compilerOptions": {
    "sourceMap": false
  },
  "tasks": {
    "build": "deno run -A scripts/build.ts"
  }
}
```

**Or in `.npmignore`:**

```
*.map
src/**/*.map
dist/**/*.map
```

**Test the fix:**

```bash
# After making changes
deno task build

# Verify no .map files in dist
ls -la dist/**/*.map  # Should show no files

# Publish and test in consuming project
```

#### Step 2: Browser-Optimized Build (Future Enhancement)

**Create `src/platforms/browser.ts`:**

```typescript
/**
 * Browser-optimized logger
 * Lightweight console wrapper with consistent formatting
 */

interface LoggerOptions {
  prefix?: string;
  enableDebug?: boolean;
}

class BrowserLogger {
  private prefix: string;
  private enableDebug: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '[Logger]';
    this.enableDebug = options.enableDebug ?? false;
  }

  info(...args: any[]): void {
    console.info(this.prefix, ...args);
  }

  warn(...args: any[]): void {
    console.warn(this.prefix, ...args);
  }

  error(...args: any[]): void {
    console.error(this.prefix, ...args);
  }

  debug(...args: any[]): void {
    if (this.enableDebug) {
      console.debug(this.prefix, ...args);
    }
  }
}

export const logger = new BrowserLogger();
export { BrowserLogger };
```

**Update package exports:**

```json
{
  "name": "@logan/logger",
  "version": "1.2.0",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "browser": "./dist/browser.js",
      "node": "./dist/index.js",
      "deno": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

## Testing the Fix

### Test in Astro Project

```bash
# In the logger package
deno task build

# Publish to JSR (or use local link)
deno publish

# In the Astro project
pnpm update @logan/logger

# Test server-side (should work)
# src/lib/turso.ts
import { logger } from '@logan/logger';
logger.info('Server-side logging works');

# Test client-side (should now work)
# src/components/Search.tsx
import { logger } from '@logan/logger';
logger.error('Client-side logging works');

# Build and verify
pnpm build  # Should succeed without errors
```

### Verify Both Environments

**Create test file `test-logger.ts`:**

```typescript
import { logger } from '@logan/logger';

logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
logger.debug('Debug message');
```

**Test in Node.js:**
```bash
node test-logger.ts
```

**Test in browser (via Astro):**
```bash
pnpm dev
# Open browser console, verify logs appear
```

## Benefits of the Fix

1. **Universal Compatibility**: Works in both Node.js and browser environments
2. **No Build Errors**: Eliminates esbuild loader errors
3. **Better DX**: Developers can use logger anywhere without worrying about environment
4. **Smaller Bundles**: Browser build only includes what's needed
5. **Maintained Features**: Server-side keeps full Winston integration

## Additional Considerations

### TypeScript Types

Ensure types work for both environments:

```typescript
// src/types.ts
export interface Logger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  debug(...args: any[]): void;
}

// Both implementations should implement this interface
```

### Environment Detection

If keeping single implementation, add runtime environment detection:

```typescript
// src/utils/runtime.ts
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node !== undefined;
}

// src/index.ts
import { isBrowser } from './utils/runtime';

const logger = isBrowser()
  ? createBrowserLogger()
  : createNodeLogger();

export { logger };
```

## Related Issues

- Similar issues in other JSR packages with source maps
- esbuild configuration in Astro/Vite projects
- Conditional exports best practices

## References

- [esbuild Loaders](https://esbuild.github.io/content-types/)
- [Node.js Package Exports](https://nodejs.org/api/packages.html#conditional-exports)
- [JSR Publishing Docs](https://jsr.io/docs/publishing-packages)
- [Astro Client-Side Scripts](https://docs.astro.build/en/guides/client-side-scripts/)

## Contributing

If you implement this fix:

1. Create a branch: `fix/browser-bundling`
2. Implement Solution 1 (remove source maps)
3. Optionally implement Solution 2 (browser build)
4. Add tests for both environments
5. Update documentation
6. Submit PR with this document as reference

## Questions?

Feel free to open an issue on the @logan/logger repository with:
- Link to this document
- Example reproduction in an Astro project
- Proposed solution preference
