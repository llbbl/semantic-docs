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
# Index markdown content (MUST run before building or when content changes)
pnpm index

# Equivalent to:
node --env-file=.env ./scripts/index-content.js
```

**Important:** Always run `pnpm index` after adding/modifying content in `./content` directory before building.

## Architecture

### Content Flow
1. **Markdown → Database**: Content in `./content` is indexed into Turso via `scripts/index-content.js`
2. **libsql-search**: Handles embedding generation (local/Gemini/OpenAI), vector storage, and semantic search
3. **Static Generation**: Article pages are pre-rendered at build time using `getStaticPaths()`
4. **Server Search**: Search API runs server-side at `/api/search.json` (requires `output: 'server'` in astro.config.mjs)

### Key Components
- **Search.tsx**: Client-side search UI with debounced API calls (300ms), displays results in dropdown
- **DocsHeader.astro**: Header with embedded search component
- **DocsSidebar.astro**: Navigation sidebar built from folder structure in database
- **DocsToc.tsx**: Auto-generated table of contents from article headings
- **[...slug].astro**: Dynamic article pages, uses `getStaticPaths()` to pre-render all articles

### Database Integration
- **src/lib/turso.ts**: Singleton client wrapper, re-exports libsql-search utilities
- **scripts/index-content.js**: Indexes markdown files, creates table with 768-dimension vectors
- All content queries use functions from libsql-search: `getAllArticles()`, `getArticleBySlug()`, `getArticlesByFolder()`, `getFolders()`

### Environment Variables
Required in `.env`:
- `TURSO_DB_URL`: Turso database URL (libsql://...)
- `TURSO_AUTH_TOKEN`: Turso authentication token
- `EMBEDDING_PROVIDER`: "local" (default), "gemini", or "openai"
- Optional: `GEMINI_API_KEY` or `OPENAI_API_KEY` (if using cloud providers)

## Critical Configuration

### Server-Side Rendering Required
The search API endpoint requires SSR. **Never** change `output: 'server'` in `astro.config.mjs` to 'static' or search will break.

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

### Hybrid Rendering
- Article pages (`/content/[...slug].astro`): Pre-rendered static (`prerender: true`)
- Search API (`/api/search.json.ts`): Server-rendered (`prerender: false`)
- This hybrid approach provides fast static pages with dynamic search

## Integration Points

### Adding New libsql-search Features
The project relies heavily on libsql-search. When modifying search behavior:
1. Check libsql-search documentation for available options
2. Update `scripts/index-content.js` for indexing changes
3. Update `src/pages/api/search.json.ts` for search query changes
4. Maintain embedding dimension consistency (768) across indexing and search

### Customizing Embedding Providers
To switch providers, update `.env` and ensure API keys are set. The dimension (768) must match across:
- `scripts/index-content.js` (createTable and indexContent)
- Search API (automatically uses same provider)
- Re-index content after switching providers

### Styling
- Uses Tailwind CSS 4 via Vite plugin
- OKLCH color space for perceptual color uniformity
- CSS variables defined in global.css for theming
- Inline styles in components for search results, article content