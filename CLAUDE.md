# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**semantic-docs** is an Astro-based documentation theme with semantic vector search powered by libsql-search. It combines static site generation with server-rendered search using Turso (libSQL) for edge-optimized semantic search capabilities.

## Essential Commands

### Development
```bash
# Install dependencies
pnpm install

# Start dev server (runs on http://localhost:4321)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Content Management
```bash
# Turso (default - requires .env with credentials)
pnpm db:init    # Initialize Turso database schema
pnpm index      # Index markdown content to Turso

# Local libSQL (for CI/testing - no .env required)
pnpm db:init:local   # Initialize local database (file:local.db)
pnpm index:local     # Index to local database

# Run tests
pnpm test

# Linting and formatting
pnpm lint       # Check code with Biome
pnpm lint:fix   # Auto-fix issues
pnpm format     # Format all files
```

**Important:**
- Always run `pnpm index` (or `pnpm index:local`) after adding/modifying content in `./content` directory before building.
- Use `db:init` and `index` for production with Turso (loads `.env` file)
- Use `db:init:local` and `index:local` for CI/local testing without Turso credentials
- The dev server (`pnpm dev`) works with either database type

## Architecture

### Content Flow
1. **Markdown → Database**: Content in `./content` is indexed into Turso via `scripts/index-content.ts`
2. **libsql-search**: Handles embedding generation (local/Gemini/OpenAI), vector storage, and semantic search
3. **Static Generation**: Article pages are pre-rendered at build time using `getStaticPaths()`
4. **Server Search**: Search API runs server-side at `/api/search.json` (requires `output: 'server'` with Node.js adapter)

### Key Components
- **Search.tsx**: Client-side search UI with debounced API calls (300ms), displays results in dropdown
- **DocsHeader.astro**: Header with embedded search component
- **DocsSidebar.astro**: Navigation sidebar built from folder structure in database
- **DocsToc.tsx**: Auto-generated table of contents from article headings
- **[...slug].astro**: Dynamic article pages, uses `getStaticPaths()` to pre-render all articles

### Database Integration
- **src/lib/turso.ts**: Singleton client wrapper, re-exports libsql-search utilities
- **scripts/init-db.ts**: Initializes database schema with vector search support
- **scripts/index-content.ts**: Indexes markdown files, creates table with 768-dimension vectors
- All content queries use functions from libsql-search: `getAllArticles()`, `getArticleBySlug()`, `getArticlesByFolder()`, `getFolders()`

### Environment Variables
Optional in `.env`:
- `TURSO_DB_URL`: Turso database URL (libsql://...) - if not set, uses local libSQL file
- `TURSO_AUTH_TOKEN`: Turso authentication token - if not set, uses local libSQL file
- `EMBEDDING_PROVIDER`: "local" (default), "gemini", or "openai"
- Optional: `GEMINI_API_KEY` or `OPENAI_API_KEY` (if using cloud providers)

**Local Development**: If Turso credentials aren't provided, the project automatically falls back to a local SQLite file (`local.db`) for database operations. This is useful for CI builds and local development without cloud dependencies.

## Critical Configuration

### Server-Side Rendering + Dual Adapter Support
The search API endpoint requires SSR with an adapter. The configuration uses:
- `output: 'server'` - Enables server-side rendering
- **Dual adapter support** - Conditionally uses Node.js or Cloudflare adapter based on `ADAPTER` env var
  - Default: `node({ mode: 'standalone' })` - For traditional Node.js deployments
  - Cloudflare: `cloudflare()` - For Cloudflare Workers (set `ADAPTER=cloudflare`)
- Article pages marked with `prerender: true` are pre-rendered as static HTML
- Search API marked with `prerender: false` runs server-side

**Adapter Selection** (astro.config.mjs:14-16):
```js
const adapter = process.env.ADAPTER === 'cloudflare'
  ? cloudflare()
  : node({ mode: 'standalone' });
```

**Never** remove the adapter or change output to 'static', or the search API will break.

### Content Structure
Content in `./content` must follow this pattern:
```
content/
├── folder-name/
│   └── article.md
```

Folders become sidebar sections. Each markdown file can have optional frontmatter:
```markdown
---
title: Article Title
tags: [tag1, tag2]
---
```

### Selective Pre-rendering
- Article pages (`/content/[...slug].astro`): Pre-rendered static at build time (`export const prerender = true`)
- Search API (`/api/search.json.ts`): Server-rendered on-demand (`export const prerender = false`)
- This approach provides fast static pages with dynamic server-side search
- Uses `getStaticPaths()` to generate all article pages at build time

## Integration Points

### Adding New libsql-search Features
The project relies heavily on libsql-search. When modifying search behavior:
1. Check libsql-search documentation for available options
2. Update `scripts/index-content.ts` for indexing changes
3. Update `src/pages/api/search.json.ts` for search query changes
4. Maintain embedding dimension consistency (768) across indexing and search

### Customizing Embedding Providers
To switch providers, update `.env` and ensure API keys are set. The dimension (768) must match across:
- `scripts/index-content.ts` (createTable and indexContent)
- Search API (automatically uses same provider)
- Re-index content after switching providers

### Styling
- Uses Tailwind CSS 4 via Vite plugin
- RGB hex colors for maximum browser compatibility
- CSS variables defined in global.css for theming
- Multi-theme system with 6 pre-built themes (dark, light, ocean, forest, sunset, purple)
- ThemeSwitcher component allows runtime theme changes
- Complementary colors for sidebar (darker) and TOC (lighter) in each theme

### Security & Rate Limiting
- In-memory rate limiting on search API: 20 requests per minute per IP
- Query length validation: 500 character maximum
- Results limit enforcement: 1-20 results
- Standard rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- See `docs/SECURITY.md` for comprehensive security considerations

## Deployment Options

> **Note**: Cloudflare Workers/Pages deployment is being developed in the `cloudflare-workers` branch.

### Node.js Platforms (Vercel, Netlify, etc.)

The project uses the Node.js adapter and can be deployed to any platform supporting Node.js:

```bash
# Build
pnpm build

# Deploy to your platform
vercel deploy
# or
netlify deploy --prod
```

### Deployment Requirements
- **Always run** `pnpm index` (or `pnpm index:local` for testing) before deploying to ensure content is indexed
- Set environment variables (`TURSO_DB_URL`, `TURSO_AUTH_TOKEN`, etc.) in your deployment platform's dashboard