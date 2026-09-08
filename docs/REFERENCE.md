# Reference

## Project Structure

```text
semantic-docs/
├── content/                    # Markdown source content
├── docs/                       # Project and operational docs
├── scripts/
│   ├── init-db.ts              # Creates schema and vector index
│   └── index-content.ts        # Indexes Markdown into libSQL/Turso
├── src/
│   ├── components/             # Header, sidebar, TOC, search UI
│   ├── layouts/                # Shared page layout
│   ├── lib/                    # Search config, env, db helpers
│   ├── middleware/             # Rate limiting and request protections
│   ├── pages/
│   │   ├── api/search.json.ts  # Search API
│   │   ├── content/[...slug].astro
│   │   └── index.astro
│   └── styles/                 # Global styles and theme variables
├── astro.config.mjs
├── justfile
└── package.json
```

## Search Path

1. `scripts/index-content.ts` reads Markdown from `./content`.
2. `@logan/libsql-search` embeds it through Cloudflare Workers AI and indexes it into `articles_cf_bgem3_1024`.
3. Article pages are pre-rendered with Astro.
4. `/api/search.json` performs semantic search at request time.

## Current Search Defaults

- table: `articles_cf_bgem3_1024`
- vector width: `1024` (fixed by `@cf/baai/bge-m3`)
- provider: `cloudflare` (Workers AI; requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`)
- local development database: `file:local.db` when Turso credentials are absent
- result cache: 500 entries, 5 minute TTL, per process
  (`SEARCH_CACHE_TTL_SECONDS`, `SEARCH_CACHE_MAX_ENTRIES`; `0` disables)
- keyword index: `articles_cf_bgem3_1024_fts` (FTS5 over title, content, tags)
- retrieval: hybrid, keyword and vector fused by reciprocal rank fusion
  (`SEARCH_HYBRID_ENABLED=false` falls back to vector only)

Those values are defined in [searchConfig.ts](../src/lib/searchConfig.ts).

### Hybrid Retrieval

Each query runs an FTS5 keyword search and a vector search concurrently, then
merges the two ranked lists by reciprocal rank fusion. Keyword retrieval covers
what dense embeddings handle worst — exact identifiers, error strings, flag
names — while vector retrieval still answers conversational queries.

Every query term is emitted as a quoted FTS5 phrase. That neutralizes the query
language (a bare `AND`, `*` or unbalanced quote would otherwise be parsed as
syntax) and makes identifier lookup precise: `"TURSO_DB_URL"` matches only where
those tokens are adjacent.

Each retriever returns three times the requested limit before fusion, since
fusion can only reorder what it is given. Exact score ties are broken in favour
of the keyword list.

The keyword index is created by `pnpm db:init` and rebuilt by `pnpm index`, and
is joined on `slug` rather than rowid because the indexer reinserts every
article with a new id. A missing index logs a warning and yields vector-only
results; an index that exists but was never populated returns zero rows
silently, so verify both steps ran after an upgrade.

`/api/search.json` returns `id, slug, title, folder, tags, distance, excerpt`.
`distance` is null for any document the keyword retriever returned, not only
those it alone found: fusion keeps the first-seen row and keyword results merge
first. bm25 relevance and vector distance are unrelated scales, so there is no
single comparable score to report.
The excerpt is a ~160 character plain-text window built by
[excerpt.ts](../src/lib/excerpt.ts), centered on the first query term where the
article contains one. Article bodies are never sent to the client.

## Current Stack

- Astro 7
- React islands
- Tailwind CSS 4
- TypeScript 7
- `@logan/libsql-search`

## Release and Quality Commands

```bash
pnpm format
pnpm lint
pnpm exec tsc --noEmit
pnpm test
```

Releases are driven from conventional commits on `main` via GitHub Actions.

## Versioning

**This project does not follow strict semver.** Breaking changes ship in minor
releases. The version number tracks release cadence, not compatibility
guarantees — read the changelog, not the version, before upgrading.

Releases are cut automatically from conventional commit subjects on `main`:

| Commit subject since the last tag | Bump |
| --- | --- |
| `feat:` / `feat(scope):` | minor |
| anything else | patch |
| `feat!:`, `fix!:`, `refactor!:`, `BREAKING CHANGE` | minor, with a warning |

A breaking-change marker does **not** produce a major on its own. Majors are
deliberate: run the Auto Release workflow manually from the Actions tab with
`allow_major` enabled. When a marker is found and suppressed, the run logs a
warning naming the version it shipped instead.

The decision lives in [`scripts/next-version.sh`](../scripts/next-version.sh)
rather than inline in the workflow, so it can be tested without cutting a
release. Only commit *subjects* are inspected — a `BREAKING CHANGE` footer in a
commit body has never been detected.
