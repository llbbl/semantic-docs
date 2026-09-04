# Deployment

## Build Model

`semantic-docs` uses:

- `output: 'server'`
- the Astro Node adapter
- pre-rendered content pages
- a server-rendered `/api/search.json` endpoint

Do not switch the project to fully static output unless you are also replacing
the search API behavior.

## Deployment Flow

For a Turso-backed deployment:

```bash
pnpm install
pnpm db:init
pnpm index
pnpm build
```

For local verification without Turso credentials:

```bash
pnpm db:init:local
pnpm index:local
TURSO_DB_URL=file:local.db TURSO_AUTH_TOKEN=local pnpm build
```

If your shell or local `.env` already exports Turso credentials, the explicit
local env vars keep the prerender build pointed at the indexed `file:local.db`
database instead. When no Turso credentials are present, runtime database access
already falls back to `file:local.db`.

## Environment Variables

Remote libSQL/Turso deployments use:

```env
TURSO_DB_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

Without those values, the project falls back to `file:local.db`.

Embeddings additionally require Workers AI credentials in every environment that
indexes or serves search:

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

## Upgrade Note

The current default index is `articles_cf_bgem3_1024`. Earlier releases embedded
in-process and wrote `articles_local_384` at 384 dimensions; that provider no
longer exists, and its vectors are in a different embedding space, so they cannot
be reused or converted. Rebuild instead:

```bash
pnpm db:init
pnpm index
```

The legacy `articles` and `articles_local_384` tables can be retired separately
once the new index is validated.

## Platform Notes

Any platform that can run the Astro Node adapter is a viable target. That
includes traditional Node.js hosts and container-based deployments.

The key requirement is that the search API remains server-rendered and the
content index is built before release. If you change Markdown content, rerun the
matching `pnpm index` or `pnpm index:local` command before the build.
