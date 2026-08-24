# Getting Started

## Requirements

- Node.js `>=22.13.0`
- pnpm `11`

## Install

```bash
git clone https://github.com/llbbl/semantic-docs.git
cd semantic-docs
pnpm install
```

You can also use the repository as a GitHub template.

## Choose a Database Mode

### Local libSQL for development and CI

This path needs no credentials and writes to `file:local.db`.

```bash
pnpm db:init:local
pnpm index:local
pnpm dev
```

### Turso for a remote database

Create a `.env` file and set:

```env
TURSO_DB_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

Then initialize and index:

```bash
pnpm db:init
pnpm index
pnpm dev
```

## Add Content

Create Markdown files under `./content/<section>/<article>.md`.

Example:

```markdown
---
title: Getting Started
tags: [tutorial, beginner]
---

# Getting Started

Your content here.
```

After adding or changing content, rebuild the index before building or
deploying:

```bash
pnpm index
```

Or, for the local database flow:

```bash
pnpm index:local
```

## Search Configuration

The current repo configuration stores vectors in `articles_local_384` and uses:

```ts
embeddingOptions: {
  provider: 'local',
  dimensions: 384,
}
```

Those values are defined in [`src/lib/searchConfig.ts`](../src/lib/searchConfig.ts)
and used by both indexing and query paths. The application depends on the
configured provider contract and vector shape, not on any specific embedding
engine inside `@logan/libsql-search`.

## Common Commands

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm format
pnpm test
pnpm exec tsc --noEmit
```

If you prefer `just`, see [just.md](./just.md).
