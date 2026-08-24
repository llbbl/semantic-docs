---
title: Semantic Docs Theme Overview
tags: [astro, theme, documentation, semantic-search]
---

# Semantic Docs Theme Overview

Semantic Docs is an Astro documentation theme with semantic search powered by
`@logan/libsql-search` and a libSQL/Turso-compatible index. It combines
pre-rendered article pages with a server-rendered search API so the site stays
fast while search remains dynamic.

**Reference Implementation**: Check out [Astro Vault](https://vault.llbbl.com) ([source](https://github.com/llbbl/astro-vault)) to see this theme in action with extensive documentation content.

## Key Features

### Semantic Vector Search
- **Vector embeddings**: Content is indexed with 384-dimension embeddings
- **Repo default**: The bundled setup uses libsql-search configured as `provider: 'local'`
- **Fast semantic search**: Natural language queries return relevant results
- **Flexible database path**: Works with a local libSQL file in development and Turso in remote deployments

### Static Site Generation
- **Pre-rendered pages**: All documentation pages are built at compile time
- **Fast page loads**: Static HTML with minimal JavaScript
- **SEO-friendly**: Proper meta tags and semantic HTML
- **Progressive enhancement**: Works without JavaScript

### Server-Side Search API
- **Rate limiting**: 20 requests per minute per IP
- **Debounced requests**: Client waits 300ms before sending query
- **Security**: Query validation, result limits, XSS protection
- **Real-time**: Search API runs through Astro's Node adapter

### Modern Tech Stack
- **Astro 7**: Server output with pre-rendered content routes
- **Tailwind CSS 4**: Utility-first CSS with custom themes
- **React 19**: For interactive components (search, TOC)
- **TypeScript 7**: Full type safety across the codebase
- **Biome**: Fast linting and formatting
- **Vitest**: Unit testing with browser mode

## Architecture

### Database Layer
```
┌─────────────────────────────────────────┐
│         Turso (Production)              │
│  or  local.db (Development)             │
│                                         │
│  - Vector embeddings (384-dim)          │
│  - Vector search index                  │
│  - Metadata (tags, folders)             │
└─────────────────────────────────────────┘
           ↑
           │ @logan/libsql-search
           │
┌─────────────────────────────────────────┐
│         Astro Application               │
│                                         │
│  Build time: getStaticPaths()           │
│  Runtime: Search API (/api/search.json) │
└─────────────────────────────────────────┘
```

### Content Pipeline
1. **Markdown files** in `./content/` directory
2. **Indexing script** (`scripts/index-content.ts`) processes files:
   - Extracts frontmatter (title, tags)
   - Generates embeddings through libsql-search's configured provider
   - Stores in database with vectors
3. **Build process** pre-renders all pages using database content
4. **Runtime** serves static pages + dynamic search API

### Search Flow
1. User types query in search box
2. Client debounces input (300ms)
3. POST request to `/api/search.json` with `{ query, limit }`
4. Server performs semantic search on the configured libSQL database
5. Results ranked by cosine similarity
6. Client displays results in dropdown

## Project Structure

```
semantic-docs/
├── content/               # Markdown documentation files
│   ├── getting-started/   # Getting started guides
│   ├── features/          # Feature documentation
│   ├── theme/             # Theme documentation
│   └── ...
├── docs/                  # Repo-level setup and operations docs
│   └── ...
├── src/
│   ├── components/       # Astro & React components
│   │   ├── DocsHeader.astro
│   │   ├── DocsSidebar.astro
│   │   ├── DocsToc.tsx
│   │   └── Search.tsx
│   ├── layouts/          # Page layouts
│   │   └── DocsLayout.astro
│   ├── pages/            # Route pages
│   │   ├── index.astro
│   │   ├── content/[...slug].astro
│   │   └── api/search.json.ts
│   ├── lib/              # Search config, env, and DB helpers
│   │   ├── searchConfig.ts
│   │   └── turso.ts
│   ├── middleware/       # Rate limiting and request protections
│   └── styles/           # Global styles
│       └── global.css
├── scripts/              # Build scripts
│   ├── init-db.ts        # Initialize database schema
│   └── index-content.ts  # Index markdown to database
├── justfile              # Optional task runner
└── package.json
```

## Configuration

### Environment Variables
```bash
# Remote libSQL / Turso
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

When those values are not set, the project falls back to `file:local.db`.

### Astro Configuration
```typescript
// astro.config.mjs
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

## Theme System

semantic-docs includes 6 built-in themes that can be switched at runtime:

- **Dark** (default): High contrast dark theme
- **Light**: Clean light theme
- **Ocean**: Blue ocean-inspired theme
- **Forest**: Green nature theme
- **Sunset**: Warm orange/red theme
- **Purple**: Royal purple theme

Themes are implemented with CSS variables and can be customized in `src/styles/global.css`.

## Working in This Repo

Run the content index before builds so the database matches your Markdown:

```bash
pnpm db:init:local
pnpm index:local
TURSO_DB_URL=file:local.db TURSO_AUTH_TOKEN=local pnpm build
```

For remote libSQL/Turso deployments, use `pnpm db:init` and `pnpm index`
instead.

## Customization

### Adding Content
1. Create markdown files in `content/` directory
2. Add frontmatter with title and tags
3. Re-run the index command before building or deploying

### Styling
- Edit `src/styles/global.css` for global styles
- Use Tailwind utilities in components
- Create new themes by adding CSS variables

### Components
- React components in `src/components/`
- Astro components for layouts and structure
- Full TypeScript support with prop validation

## Links

- **Live Demo**: [vault.llbbl.com](https://vault.llbbl.com)
- **GitHub**: [llbbl/semantic-docs](https://github.com/llbbl/semantic-docs)
- **Astro**: [astro.build](https://astro.build)
- **Turso**: [turso.tech](https://turso.tech)
