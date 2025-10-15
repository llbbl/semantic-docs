# semantic-docs

Documentation theme with semantic vector search.

A beautiful, dark-mode documentation theme powered by [libsql-search](https://github.com/llbbl/libsql-search) for semantic search capabilities. Perfect for technical documentation, knowledge bases, and content-heavy sites.

## Features

- 🎨 **Modern Dark UI** - Sleek design with OKLCH colors
- 🔍 **Semantic Search** - AI-powered vector search in the header
- 📱 **Responsive** - Mobile-friendly with collapsible sidebar
- 📑 **Auto TOC** - Table of contents generated from headings
- 🚀 **Edge-Ready** - Optimized for Turso's global database
- ⚡ **Fast** - Static generation with server-rendered search
- 🎯 **Type-Safe** - Full TypeScript support

## Quick Start

### 1. Clone or Use as Template

```bash
git clone https://github.com/llbbl/semantic-docs.git
cd semantic-docs
```

Or use as a template on GitHub.

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment

Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
TURSO_DB_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
EMBEDDING_PROVIDER=local
```

**Get Turso credentials:**

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up and authenticate
turso auth signup

# Create a database
turso db create my-docs

# Get credentials
turso db show my-docs
```

### 4. Add Your Content

Create markdown files in `./content`:

```bash
mkdir -p content/getting-started
echo "# Hello World\n\nThis is my first article." > content/getting-started/intro.md
```

**Front matter support:**

```markdown
---
title: Getting Started
tags: [tutorial, beginner]
---

# Getting Started

Your content here...
```

### 5. Index Content

```bash
# Initialize database and index content to Turso
pnpm db:init
pnpm index

# Or use local database without Turso (for testing)
pnpm db:init:local
pnpm index:local
```

This will:
- Scan your markdown files
- Generate embeddings (using local model by default)
- Store everything in Turso (or local.db with `:local` commands)

### 6. Start Development

```bash
pnpm dev
```

Visit `http://localhost:4321` to see your docs!

## Customization

### Change Site Title

Edit `src/components/DocsHeader.astro`:

```astro
<span class="font-sans">Your Site Name</span>
```

And `src/layouts/DocsLayout.astro`:

```astro
const { title = "Your Site Name", description = "Your description" } = Astro.props;
```

### Customize Colors

Edit `src/styles/global.css` to change the color scheme. The theme uses OKLCH colors for smooth gradients and perceptual uniformity.

### Change Embedding Provider

**Use Gemini** (free tier: 1,500 requests/day):

```env
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your-key
```

**Use OpenAI** (paid):

```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your-key
```

## Project Structure

```
semantic-docs/
├── src/
│   ├── components/
│   │   ├── DocsHeader.astro    # Header with search
│   │   ├── DocsSidebar.astro   # Navigation sidebar
│   │   ├── DocsToc.tsx         # Table of contents
│   │   └── Search.tsx          # Search component
│   ├── layouts/
│   │   └── DocsLayout.astro    # Main layout
│   ├── lib/
│   │   └── turso.ts            # Database client
│   ├── pages/
│   │   ├── api/
│   │   │   └── search.json.ts  # Search API endpoint
│   │   ├── content/
│   │   │   └── [...slug].astro # Article pages
│   │   └── index.astro         # Home page
│   └── styles/
│       └── global.css          # Global styles
├── scripts/
│   └── index-content.js        # Indexing script
├── content/                    # Your markdown files
├── astro.config.mjs
├── package.json
└── .env                        # Your credentials
```

## Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod

# Add environment variables in Netlify dashboard
```

### Cloudflare Pages

```bash
# Build
pnpm build

# Deploy dist/ folder via Cloudflare dashboard
```

**Important:** Run `pnpm index` before building to ensure content is indexed.

## Content Organization

The theme automatically organizes content by folder:

```
content/
├── getting-started/
│   ├── intro.md
│   └── installation.md
├── guides/
│   ├── configuration.md
│   └── deployment.md
└── reference/
    └── api.md
```

Folders become collapsible sections in the sidebar.

## Search

The search bar in the header provides semantic search:

- **Semantic matching**: Finds content by meaning, not just keywords
- **Instant results**: Real-time as you type
- **Smart ranking**: Most relevant results first
- **Tag display**: Shows article tags in results

Try searching for concepts rather than exact phrases!

## Build for Production

```bash
# Index content
pnpm index

# Build site
pnpm build

# Preview
pnpm preview
```

## Troubleshooting

### Search not working

1. Check `.env` file has correct credentials
2. Ensure `output: 'server'` in `astro.config.mjs`
3. Verify content is indexed: run `pnpm index`

### Content not showing

1. Run `pnpm index` to index your markdown files
2. Check content is in `./content` directory
3. Verify Turso database has data

### Local embedding model slow

First run downloads ~50MB model. Subsequent runs use cache.

Use Gemini for faster embeddings:

```env
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your-key
```

## Tech Stack

- **Framework**: [Astro](https://astro.build) 5
- **Search**: [libsql-search](https://github.com/llbbl/libsql-search)
- **Database**: [Turso](https://turso.tech) (libSQL)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) 4
- **UI**: React islands for interactivity
- **Embeddings**: Xenova, Gemini, or OpenAI

## License

MIT

## Support

- [Issues](https://github.com/llbbl/semantic-docs/issues)
- [Discussions](https://github.com/llbbl/semantic-docs/discussions)

## Credits

Built with [libsql-search](https://github.com/llbbl/libsql-search).
