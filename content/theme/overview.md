---
title: Semantic Docs Theme Overview
tags: [astro, theme, documentation, semantic-search]
---

# Semantic Docs Theme Overview

Semantic Docs is a modern documentation theme built with Astro, featuring semantic vector search powered by libSQL and Turso. It combines static site generation with server-rendered search capabilities for a fast, searchable documentation experience.

**Reference Implementation**: Check out [Astro Vault](https://vault.llbbl.com) ([source](https://github.com/llbbl/astro-vault)) to see this theme in action with extensive documentation content.

## Key Features

### Semantic Vector Search
- **Vector embeddings**: Content is indexed with 768-dimension embeddings
- **Three embedding providers**: Local (onnxruntime), Gemini, or OpenAI
- **Fast semantic search**: Natural language queries return relevant results
- **Edge-optimized**: Runs on Turso's edge database for low latency

### Static Site Generation
- **Pre-rendered pages**: All documentation pages are built at compile time
- **Fast page loads**: Static HTML with minimal JavaScript
- **SEO-friendly**: Proper meta tags and semantic HTML
- **Progressive enhancement**: Works without JavaScript

### Server-Side Search API
- **Rate limiting**: 20 requests per minute per IP
- **Debounced requests**: Client waits 300ms before sending query
- **Security**: Query validation, result limits, XSS protection
- **Real-time**: Search API runs on Node.js adapter

### Modern Tech Stack
- **Astro 5**: Latest version with hybrid rendering
- **Tailwind CSS 4**: Utility-first CSS with custom themes
- **React 19**: For interactive components (search, TOC)
- **TypeScript**: Full type safety across the codebase
- **Biome**: Fast linting and formatting
- **Vitest**: Unit testing with browser mode

## Architecture

### Database Layer
```
┌─────────────────────────────────────────┐
│         Turso (Production)              │
│  or  local.db (Development)             │
│                                         │
│  - Vector embeddings (768-dim)          │
│  - Full-text search                     │
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
   - Generates embeddings
   - Stores in database with vectors
3. **Build process** pre-renders all pages using database content
4. **Runtime** serves static pages + dynamic search API

### Search Flow
1. User types query in search box
2. Client debounces input (300ms)
3. Fetch request to `/api/search.json?q=query&limit=10`
4. Server performs semantic search on Turso
5. Results ranked by cosine similarity
6. Client displays results in dropdown

## Project Structure

```
semantic-docs/
├── content/               # Markdown documentation files
│   ├── getting-started/  # Getting started guides
│   ├── features/         # Feature documentation
│   ├── theme/            # Theme documentation
│   └── ...
├── src/
│   ├── components/       # Astro & React components
│   │   ├── DocsHeader.astro
│   │   ├── DocsSidebar.astro
│   │   ├── DocsToc.tsx
│   │   └── Search.tsx
│   ├── layouts/          # Page layouts
│   │   └── Layout.astro
│   ├── pages/            # Route pages
│   │   ├── index.astro
│   │   ├── content/[...slug].astro
│   │   └── api/search.json.ts
│   ├── lib/              # Utilities
│   │   └── turso.ts      # Database client
│   └── styles/           # Global styles
│       └── global.css
├── scripts/              # Build scripts
│   ├── init-db.ts        # Initialize database schema
│   └── index-content.ts  # Index markdown to database
└── public/               # Static assets
```

## Configuration

### Environment Variables
```bash
# Production (Turso)
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Embedding provider (optional, defaults to "local")
EMBEDDING_PROVIDER=local  # or "gemini" or "openai"

# API keys (if using cloud embeddings)
GEMINI_API_KEY=your-key
OPENAI_API_KEY=your-key
```

### Astro Configuration
```typescript
// astro.config.mjs
export default defineConfig({
  output: 'server',           // Hybrid rendering
  adapter: node(),            // Node.js adapter for search API
  integrations: [
    react(),                  // React for interactive components
    tailwindcss(),           // Tailwind CSS 4
  ],
});
```

## Theme System

Astro Vault includes 6 built-in themes that can be switched at runtime:

- **Dark** (default): High contrast dark theme
- **Light**: Clean light theme
- **Ocean**: Blue ocean-inspired theme
- **Forest**: Green nature theme
- **Sunset**: Warm orange/red theme
- **Purple**: Royal purple theme

Themes are implemented with CSS variables and can be customized in `src/styles/global.css`.

## Performance

### Build Performance
- **Incremental builds**: Only changed files are rebuilt
- **Parallel processing**: Multiple pages built concurrently
- **Fast embeddings**: Local embeddings run on CPU/GPU
- **Efficient bundling**: Astro's optimized build pipeline

### Runtime Performance
- **Static pages**: < 100ms load time
- **Search latency**: ~50-200ms (Turso edge network)
- **Small bundle size**: ~50KB JavaScript (gzipped)
- **Lighthouse score**: 95+ on all metrics

## Deployment

### Docker
```bash
# Build with Turso credentials
docker build \
  --build-arg TURSO_DB_URL=libsql://your-db.turso.io \
  --build-arg TURSO_AUTH_TOKEN=your-token \
  -t astro-vault .

# Run
docker run -p 4321:4321 \
  -e TURSO_DB_URL=libsql://your-db.turso.io \
  -e TURSO_AUTH_TOKEN=your-token \
  astro-vault
```

### Coolify
1. Set build arguments: `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`
2. Set runtime environment variables (same values)
3. Deploy - content is automatically indexed during build

### Other Platforms
- **Vercel**: Use `@astrojs/vercel` adapter
- **Netlify**: Use `@astrojs/netlify` adapter
- **Cloud Run**: Use Docker image
- **Fly.io**: Use Docker image

## Customization

### Adding Content
1. Create markdown files in `content/` directory
2. Add frontmatter with title and tags
3. Deploy - content is indexed automatically

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
