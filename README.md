# semantic-docs

[![Coverage](https://img.shields.io/codecov/c/github/llbbl/semantic-docs?label=coverage)](https://codecov.io/gh/llbbl/semantic-docs) [![CI](https://github.com/llbbl/semantic-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/llbbl/semantic-docs/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/llbbl/semantic-docs)](https://github.com/llbbl/semantic-docs/releases)

`semantic-docs` is an Astro documentation theme with built-in semantic search powered by [`@logan/libsql-search`](https://github.com/llbbl/libsql-search). It gives you static docs pages, a server-rendered search API, and a libSQL/Turso-backed content index without adding a separate hosted search product.

Use it when you want:

- semantic search over Markdown content with a small operational footprint
- a docs site you can ship quickly without giving up control of layout, content, or deployment
- a lightweight alternative to bolting on a hosted search product

## What You Get

- Semantic search in the header, backed by libSQL/Turso
- Static article pages with a server-rendered search endpoint
- Sidebar navigation and table of contents generated from your content
- A local development path that works without Turso credentials

## Quick Start

Requires Node.js `>=22.13.0` and pnpm `11`.

```bash
git clone https://github.com/llbbl/semantic-docs.git
cd semantic-docs
pnpm install
pnpm db:init:local
pnpm index:local
pnpm dev
```

Open `http://localhost:4321`.

The local path works without Turso credentials. The current repo defaults to the
`articles_local_384` index with libsql-search configured as `provider: 'local'`
at 384 dimensions. When you want a remote libSQL/Turso database, switch to the
`.env`-driven commands in the docs.

## Documentation

- [Docs index](./docs/README.md)
- [Setup and indexing](./docs/GETTING_STARTED.md)
- [Deployment notes](./docs/DEPLOYMENT.md)
- [Project reference](./docs/REFERENCE.md)
- [Security considerations](./docs/SECURITY.md)
- [Just task runner](./docs/just.md)

## Content Shape

Store Markdown under `./content` using folder-based sections:

```text
content/
├── getting-started/
│   └── intro.md
├── guides/
│   └── deployment.md
└── reference/
    └── api.md
```

Folders become sidebar groups, and frontmatter can define titles and tags.

## Development Checks

```bash
pnpm format
pnpm lint
pnpm exec tsc --noEmit
pnpm test
```

## License

MIT
