# Multi-stage production Dockerfile with pnpm (npm removed for security)
# Uses Turso database for production deployments
# Automatically indexes content to Turso during build

# Stage 1: Base
FROM node:24-alpine AS base

# Enable Corepack and prepare pnpm from package.json
RUN corepack enable

WORKDIR /app

# Copy package files to read packageManager version
COPY package.json pnpm-lock.yaml ./

# Activate pnpm version from package.json
RUN corepack prepare "$(node -p "require('./package.json').packageManager")" --activate

# Stage 2: Dependencies
FROM base AS deps

# Copy package files (already in base, but explicit for clarity)
COPY package.json pnpm-lock.yaml ./

# Install all dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Stage 3: Builder
FROM base AS builder

# Build arguments for Turso credentials (required for indexing and pre-rendering)
ARG TURSO_DB_URL
ARG TURSO_AUTH_TOKEN
ARG EMBEDDING_PROVIDER=local

# Set environment variables for build
ENV TURSO_DB_URL=$TURSO_DB_URL
ENV TURSO_AUTH_TOKEN=$TURSO_AUTH_TOKEN
ENV EMBEDDING_PROVIDER=$EMBEDDING_PROVIDER

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Index content to Turso database (env vars already set via ENV directives)
RUN pnpm exec tsx scripts/init-db.ts && pnpm exec tsx scripts/index-content.ts

# Build application (queries Turso database for static pre-rendering)
RUN pnpm build

# Stage 4: Production dependencies
FROM base AS prod-deps

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only with frozen lockfile
RUN pnpm install --prod --frozen-lockfile

# Stage 5: Runner (production runtime)
FROM node:24-alpine AS runner

# Enable Corepack
RUN corepack enable

WORKDIR /app

# Copy package files to read packageManager version
COPY package.json pnpm-lock.yaml ./

# Activate pnpm version from package.json
RUN corepack prepare "$(node -p "require('./package.json').packageManager")" --activate

# Remove npm and npx to eliminate CVEs while preserving Corepack
RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack/dist/npm*.js \
    /usr/local/lib/node_modules/corepack/dist/npx*.js \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /opt/corepack/shims/npm \
    /opt/corepack/shims/npx 2>/dev/null || true

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/local.db ./local.db

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S astro -u 1001 -G nodejs

# Change ownership
RUN chown -R astro:nodejs /app

# Switch to non-root user
USER astro

# Expose port
EXPOSE 4321

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4321/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "./dist/server/entry.mjs"]
