# Dockerfile pnpm Standardization and npm CVE Elimination

## Overview

This document describes the migration from npm to pnpm in Docker builds, eliminating npm security vulnerabilities while maintaining reproducible builds across all environments.

**Key Changes:**
- Multi-stage Docker build with 5 optimized stages
- Complete npm/npx removal from production runtime
- Frozen lockfile strategy for reproducibility
- Dynamic pnpm version detection from `package.json`
- Upgraded to Node.js 24 LTS
- Enhanced caching strategy in CI/CD

## Architecture

### Multi-Stage Docker Build Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Stage 1: Base                               │
│  - Node.js 24 Alpine                                            │
│  - Enable Corepack                                              │
│  - Copy package.json & pnpm-lock.yaml                           │
│  - Activate pnpm from packageManager field                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  Stage 2: deps      │         │ Stage 3: builder    │
│  - Install all deps │         │ - Copy deps         │
│  - Frozen lockfile  │         │ - Copy source       │
│  - Dev + prod       │         │ - Init/index DB     │
└─────────────────────┘         │ - Build app         │
                                └──────────┬──────────┘
                                           │
                                ┌──────────┴──────────┐
                                │                     │
                                ▼                     ▼
                      ┌─────────────────────┐  ┌─────────────┐
                      │ Stage 4: prod-deps  │  │ Artifacts:  │
                      │ - Prod deps only    │  │ - dist/     │
                      │ - Frozen lockfile   │  │ - local.db  │
                      └──────────┬──────────┘  └─────────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Stage 5: runner     │
                      │ - Node.js 24 Alpine │
                      │ - Corepack enabled  │
                      │ - npm/npx REMOVED   │
                      │ - Non-root user     │
                      │ - Production ready  │
                      └─────────────────────┘
```

### Stage Breakdown

#### Stage 1: Base
**Purpose:** Establish foundation with Corepack and pnpm
```dockerfile
FROM node:24-alpine AS base
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare "$(node -p "require('./package.json').packageManager")" --activate
```

**Key Features:**
- Dynamically reads pnpm version from `package.json`
- Enables Corepack for version management
- Shared base for all subsequent stages

#### Stage 2: Dependencies
**Purpose:** Install all dependencies (dev + production)
```dockerfile
FROM base AS deps
RUN pnpm install --frozen-lockfile
```

**Key Features:**
- Uses `--frozen-lockfile` for reproducibility
- Installs complete dependency tree for building

#### Stage 3: Builder
**Purpose:** Build the application and index content
```dockerfile
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec tsx scripts/init-db.ts && pnpm exec tsx scripts/index-content.ts
RUN pnpm build
```

**Key Features:**
- Receives all dependencies from deps stage
- Initializes and indexes database
- Produces static build output

#### Stage 4: Production Dependencies
**Purpose:** Install only production dependencies
```dockerfile
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile
```

**Key Features:**
- Excludes devDependencies for smaller image
- Maintains frozen lockfile for consistency

#### Stage 5: Runner
**Purpose:** Minimal production runtime with npm removed
```dockerfile
FROM node:24-alpine AS runner
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare "$(node -p "require('./package.json').packageManager")" --activate
RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack/dist/npm*.js \
    /usr/local/lib/node_modules/corepack/dist/npx*.js \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /opt/corepack/shims/npm \
    /opt/corepack/shims/npx 2>/dev/null || true
```

**Key Features:**
- Complete npm/npx removal eliminates npm CVEs
- Preserves Corepack for pnpm functionality
- Non-root user (astro:nodejs)
- Minimal attack surface

## Version Synchronization Strategy

### Single Source of Truth: package.json

All pnpm versions are synchronized through the `packageManager` field:

```json
{
  "packageManager": "pnpm@10.0.0"
}
```

### Version Detection Mechanisms

| Environment | Detection Method | Configuration |
|-------------|------------------|---------------|
| **Dockerfile** | `corepack prepare "$(node -p "require('./package.json').packageManager")" --activate` | Dynamic shell evaluation |
| **GitHub Actions** | `pnpm/action-setup@v4` with `run_install: false` | Auto-detects from package.json |
| **Local Development** | Corepack reads `packageManager` field | Automatic via Corepack |

### Benefits

1. **No Version Drift:** All environments use identical pnpm version
2. **Easy Updates:** Change one field in package.json
3. **Fail-Safe:** Missing packageManager field causes immediate failure
4. **Auditable:** Version is tracked in git

## Security Rationale: npm CVE Elimination

### Why Remove npm?

**npm vulnerabilities cannot be patched without removing npm entirely:**

- npm ships with Node.js by default
- npm has its own dependency tree with potential CVEs
- Zero npm usage in this project (100% pnpm)
- Keeping npm installed = unnecessary attack surface

### What Gets Removed

```bash
# npm core package
/usr/local/lib/node_modules/npm

# npm shims in Corepack
/usr/local/lib/node_modules/corepack/dist/npm*.js
/usr/local/lib/node_modules/corepack/dist/npx*.js

# npm binaries
/usr/local/bin/npm
/usr/local/bin/npx

# npm shim directories
/opt/corepack/shims/npm
/opt/corepack/shims/npx
```

### What Gets Preserved

- **Corepack:** Essential for pnpm management
- **Node.js:** Runtime engine
- **pnpm binaries:** Active package manager

### Security Impact

| Before | After |
|--------|-------|
| npm CVEs present | npm CVEs eliminated |
| Two package managers | One package manager |
| Larger attack surface | Minimal attack surface |
| Potential confusion | Clear package manager choice |

## GitHub Actions Configuration

### Strategy Applied: No Registry Override

This repository uses the standard public npm registry, so no registry override is required.

### Key Configuration

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '24'

- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    run_install: false  # Auto-detects from package.json

- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

### Enhanced Caching Strategy

```yaml
- name: Get pnpm store directory
  shell: bash
  run: |
    echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

**Benefits:**
- Faster CI runs with cached dependencies
- Cache invalidation on lockfile changes
- Cross-job cache sharing

## Files Modified

### 1. package.json

**Added:**
```json
"packageManager": "pnpm@10.0.0"
```

**Location:** Line 25

### 2. Dockerfile

**Changes:**
- Upgraded base image: `node:20-slim` → `node:24-alpine`
- Converted to 5-stage multi-stage build
- Added dynamic pnpm version detection
- Changed install flag: `--no-frozen-lockfile` → `--frozen-lockfile`
- Added npm/npx removal in runner stage
- Added proper Alpine user creation commands

**Location:** Root directory

### 3. .dockerignore

**Critical Fix:**
```diff
- pnpm-lock.yaml
+ # pnpm-lock.yaml is REQUIRED for frozen lockfile builds (do not ignore)
```

**Why:** The lockfile must be copied into Docker to use `--frozen-lockfile`

### 4. .github/workflows/ci.yml

**Changes:**
- Updated Node.js version: `20` → `24`
- Changed pnpm setup: `version: 10` → `run_install: false`
- Added pnpm store caching
- Changed install command: `pnpm install` → `pnpm install --frozen-lockfile`

## Manual Verification Commands

### Verify pnpm Version Synchronization

```bash
# Check package.json
cat package.json | grep packageManager

# Check Corepack configuration
corepack prepare --activate pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")

# Verify active pnpm version
pnpm --version
```

**Expected Output:**
All commands should show `10.0.0` (or whatever version is in package.json)

### Verify Docker Build

```bash
# Build the Docker image
docker build -t semantic-docs:test \
  --build-arg TURSO_DB_URL=$TURSO_DB_URL \
  --build-arg TURSO_AUTH_TOKEN=$TURSO_AUTH_TOKEN \
  .

# Check that npm is removed
docker run --rm semantic-docs:test which npm
# Expected: empty output or "not found"

docker run --rm semantic-docs:test which npx
# Expected: empty output or "not found"

# Check that pnpm exists
docker run --rm semantic-docs:test which pnpm
# Expected: /usr/local/bin/pnpm

# Check pnpm version
docker run --rm semantic-docs:test pnpm --version
# Expected: 10.0.0 (matches package.json)
```

### Verify GitHub Actions

```bash
# Trigger CI workflow
git push origin feature-branch

# Check workflow logs for:
# 1. "Setup pnpm" step should NOT show hardcoded version
# 2. "Install dependencies" should show "Lockfile is up to date"
# 3. Cache hit/miss messages in "Setup pnpm cache"
```

### Verify Frozen Lockfile Enforcement

```bash
# Modify a dependency version in package.json
sed -i 's/"astro": ".*"/"astro": "^5.0.0"/' package.json

# Try to build (should fail due to lockfile mismatch)
docker build -t semantic-docs:test .
# Expected: Error about lockfile being out of sync

# Restore package.json
git checkout package.json
```

## Troubleshooting

### Issue: Docker build fails with "pnpm: command not found"

**Cause:** Corepack not enabled or pnpm not activated

**Solution:**
```bash
# Verify Corepack is enabled in Dockerfile
grep "corepack enable" Dockerfile

# Verify pnpm activation command exists
grep "corepack prepare" Dockerfile
```

### Issue: "ERR_PNPM_OUTDATED_LOCKFILE"

**Cause:** pnpm-lock.yaml doesn't match package.json

**Solution:**
```bash
# Regenerate lockfile locally
pnpm install

# Commit the updated lockfile
git add pnpm-lock.yaml
git commit -m "Update pnpm lockfile"
```

### Issue: Docker build fails with "registry.npmjs.org" connection errors

**Cause:** Network issues or registry downtime

**Solution:**
```bash
# Check registry status
curl -I https://registry.npmjs.org/

# Retry with longer timeout
docker build --network=host --build-arg HTTP_TIMEOUT=60000 .
```

### Issue: "npm not found" but need npm for a specific command

**Cause:** npm removed in production image

**Solution:**
```bash
# Use pnpm equivalents:
npm install → pnpm install
npm run script → pnpm run script
npm exec command → pnpm exec command
npx command → pnpm dlx command

# If absolutely necessary, use a separate build stage with npm
```

### Issue: GitHub Actions cache not working

**Cause:** Cache key mismatch or store path incorrect

**Solution:**
```bash
# Verify pnpm store path
pnpm store path --silent

# Check cache key matches lockfile hash
sha256sum pnpm-lock.yaml
```

### Issue: Different pnpm version in CI vs Docker

**Cause:** Hardcoded version somewhere

**Solution:**
```bash
# Search for hardcoded versions
grep -r "pnpm@" .github/
grep -r "version:" .github/workflows/

# Ensure all use run_install: false or dynamic detection
```

## Migration Checklist

Use this checklist when applying pnpm standardization to other repositories:

- [ ] **Detection Phase**
  - [ ] Check for custom registry in .npmrc
  - [ ] Check for custom registry in .pnpmrc
  - [ ] Determine Strategy A (override) or B (no override)

- [ ] **package.json**
  - [ ] Add `packageManager` field with specific pnpm version
  - [ ] Verify field is at top level (not in dependencies)

- [ ] **Dockerfile**
  - [ ] Upgrade to `node:24-alpine`
  - [ ] Implement 5-stage multi-stage build
  - [ ] Add dynamic pnpm version detection in all stages
  - [ ] Use `--frozen-lockfile` flag
  - [ ] Add npm/npx removal in runner stage
  - [ ] Add registry override if Strategy A

- [ ] **.dockerignore**
  - [ ] Ensure `pnpm-lock.yaml` is NOT ignored
  - [ ] Add comment explaining why

- [ ] **GitHub Actions**
  - [ ] Update Node.js to version 24
  - [ ] Change pnpm setup to `run_install: false`
  - [ ] Add pnpm store caching
  - [ ] Use `--frozen-lockfile` in install commands
  - [ ] Add registry override if Strategy A (TWO steps)

- [ ] **Documentation**
  - [ ] Create this documentation file
  - [ ] Document registry strategy used
  - [ ] Add verification commands

- [ ] **Testing**
  - [ ] Run local Docker build
  - [ ] Verify npm removal
  - [ ] Verify pnpm version matches
  - [ ] Test CI pipeline
  - [ ] Verify lockfile enforcement

## Additional Resources

- [pnpm Documentation](https://pnpm.io/)
- [Corepack Documentation](https://nodejs.org/api/corepack.html)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Node.js 24 Release Notes](https://nodejs.org/en/blog/release/)
- [GitHub Actions Caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)

## Change History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-19 | 1.0.0 | Initial pnpm standardization migration |
|  |  | - Multi-stage Dockerfile |
|  |  | - npm removal implementation |
|  |  | - GitHub Actions updates |
|  |  | - Strategy B (no registry override) |
