# syntax=docker/dockerfile:1
# Production Dockerfile - Uses Turso database and Cloudflare Workers AI.
#
# Build (BuildKit required; secrets are never written to image layers):
#   docker build \
#     --secret id=turso_db_url,env=TURSO_DB_URL \
#     --secret id=turso_auth_token,env=TURSO_AUTH_TOKEN \
#     --secret id=cloudflare_account_id,env=CLOUDFLARE_ACCOUNT_ID \
#     --secret id=cloudflare_api_token,env=CLOUDFLARE_API_TOKEN \
#     -t semantic-docs .
#
# Run (the same four values are needed again at runtime: every search embeds
# its query through Workers AI and reads vectors from Turso):
#   docker run -p 4321:4321 \
#     -e TURSO_DB_URL -e TURSO_AUTH_TOKEN \
#     -e CLOUDFLARE_ACCOUNT_ID -e CLOUDFLARE_API_TOKEN \
#     semantic-docs

# Build stage
FROM node:22-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Index content into Turso. Needs Workers AI credentials as well as Turso ones:
# indexing embeds every chunk through @cf/baai/bge-m3. `required=true` fails the
# build with a named secret rather than letting the script exit 1 on its own.
RUN --mount=type=secret,id=turso_db_url,required=true \
    --mount=type=secret,id=turso_auth_token,required=true \
    --mount=type=secret,id=cloudflare_account_id,required=true \
    --mount=type=secret,id=cloudflare_api_token,required=true \
    export TURSO_DB_URL="$(cat /run/secrets/turso_db_url)" && \
    export TURSO_AUTH_TOKEN="$(cat /run/secrets/turso_auth_token)" && \
    export CLOUDFLARE_ACCOUNT_ID="$(cat /run/secrets/cloudflare_account_id)" && \
    export CLOUDFLARE_API_TOKEN="$(cat /run/secrets/cloudflare_api_token)" && \
    pnpm exec tsx scripts/init-db.ts && \
    pnpm exec tsx scripts/index-content.ts

# Pre-render content pages. Reads articles back out of Turso, so it needs those
# credentials but not the Workers AI ones.
RUN --mount=type=secret,id=turso_db_url,required=true \
    --mount=type=secret,id=turso_auth_token,required=true \
    export TURSO_DB_URL="$(cat /run/secrets/turso_db_url)" && \
    export TURSO_AUTH_TOKEN="$(cat /run/secrets/turso_auth_token)" && \
    pnpm build

# Production stage
FROM node:22-slim AS runtime

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder. No local.db: this image reads from Turso,
# and shipping an empty file would let a credential-less container start up
# quietly serving nothing.
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs astro

# Change ownership
RUN chown -R astro:nodejs /app

# Switch to non-root user
USER astro

# Expose port
EXPOSE 4321

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=4321

# Health check. Hits the search-readiness endpoint rather than `/`, which is
# prerendered and would report healthy on a container that cannot search.
# 127.0.0.1 rather than localhost: the server binds IPv4 only, and localhost
# can resolve to ::1 first.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4321/api/health.json',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start the server
CMD ["node", "./dist/server/entry.mjs"]
