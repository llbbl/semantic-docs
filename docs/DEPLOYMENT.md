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

Set the public origin so canonical and Open Graph URLs are correct:

```env
SITE_URL=https://docs.your-domain.com
```

It defaults to `http://localhost:4321` and warns at build time when unset. See
[Customize](./GETTING_STARTED.md#customize) for the rest of the site identity.

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

## Containers

Two Dockerfiles are provided. Both index content during the build, and indexing
embeds every chunk through Workers AI, so **both need Cloudflare credentials at
build time as well as at runtime**. Builds require BuildKit, which is the
default in current Docker; credentials are passed as build secrets so they are
never written into an image layer.

`Dockerfile` builds against Turso and ships no database file — the running
container reads vectors from Turso:

```bash
docker build \
  --secret id=turso_db_url,env=TURSO_DB_URL \
  --secret id=turso_auth_token,env=TURSO_AUTH_TOKEN \
  --secret id=cloudflare_account_id,env=CLOUDFLARE_ACCOUNT_ID \
  --secret id=cloudflare_api_token,env=CLOUDFLARE_API_TOKEN \
  -t semantic-docs .

docker run -p 4321:4321 \
  -e TURSO_DB_URL -e TURSO_AUTH_TOKEN \
  -e CLOUDFLARE_ACCOUNT_ID -e CLOUDFLARE_API_TOKEN \
  semantic-docs
```

`Dockerfile.local` indexes into a `local.db` that is baked into the image, so it
needs no Turso credentials — but it still needs the Cloudflare pair in both
phases:

```bash
docker build -f Dockerfile.local \
  --secret id=cloudflare_account_id,env=CLOUDFLARE_ACCOUNT_ID \
  --secret id=cloudflare_api_token,env=CLOUDFLARE_API_TOKEN \
  -t semantic-docs-local .

docker run -p 4321:4321 \
  -e CLOUDFLARE_ACCOUNT_ID -e CLOUDFLARE_API_TOKEN \
  semantic-docs-local
```

`docker compose up --build` runs the `Dockerfile.local` path and reads both
Cloudflare values from your environment or `.env`, failing with a named error if
either is unset.

A missing build secret fails the build immediately, before any dependency
install, rather than partway through indexing.

### Health Endpoint

`GET /api/health.json` reports whether the instance can actually serve a search:

```json
{ "status": "ok", "checks": { "database": true, "embeddings": true } }
```

It returns 503 when the search table cannot be read or the Workers AI
credentials are absent. Both images use it as their `HEALTHCHECK`. Do not point
a healthcheck at `/` — that page is prerendered and answers 200 from a container
whose database is unreachable.

## Platform Notes

Any platform that can run the Astro Node adapter is a viable target. That
includes traditional Node.js hosts and container-based deployments.

The key requirement is that the search API remains server-rendered and the
content index is built before release. If you change Markdown content, rerun the
matching `pnpm index` or `pnpm index:local` command before the build.
