# semantic-docs - justfile
# Run `just` or `just help` to see available commands

# Default recipe: show help
default:
    @just --list --unsorted

# Install dependencies
install:
    pnpm install

# Install dependencies (frozen lockfile, for CI)
install-frozen:
    pnpm install --frozen-lockfile

# Start dev server
dev:
    pnpm dev

# Build for production
build:
    pnpm build

# Preview production build
preview:
    pnpm preview

# Run tests
test *ARGS:
    pnpm test {{ ARGS }}

# Run tests in CI mode (no watch)
test-run:
    pnpm test --run

# Run tests with coverage
test-coverage:
    pnpm test:coverage

# Check coverage for low-coverage files
uncov:
    pnpm uncov

# Run linter (Biome)
lint:
    pnpm lint

# Fix lint issues and format code
lint-fix:
    pnpm lint:fix

# Format code (alias for lint-fix, Biome handles both)
format: lint-fix

# Type check
typecheck:
    pnpm exec tsc --noEmit

# Initialize Turso database schema (uses .env)
db-init:
    pnpm db:init

# Initialize local database (no .env required)
db-init-local:
    pnpm db:init:local

# Index content to Turso (uses .env)
index:
    pnpm index

# Index content to local database
index-local:
    pnpm index:local

# Run all checks (lint + typecheck + test)
check: lint typecheck test-run

# Full CI workflow locally
ci: install-frozen test-run db-init-local index-local build typecheck lint

# Clean build artifacts
clean:
    rm -rf dist coverage logs local.db .astro

# Clean everything including dependencies
clean-all: clean
    rm -rf node_modules

# Generate full changelog
changelog:
    git cliff -o CHANGELOG.md

# Preview unreleased changes
changelog-preview:
    git cliff --unreleased

# ============================================================================
# Version Management
# ============================================================================

# Show current version
version:
    @echo "Current version: $(jq -r '.version' package.json)"

# Bump patch version (0.1.2 → 0.1.3)
bump-patch:
    #!/bin/sh
    set -e
    CURRENT=$(jq -r '.version' package.json)
    echo "Current version: $CURRENT"
    MAJOR=$(echo "$CURRENT" | cut -d. -f1)
    MINOR=$(echo "$CURRENT" | cut -d. -f2)
    PATCH=$(echo "$CURRENT" | cut -d. -f3)
    NEW="$MAJOR.$MINOR.$((PATCH + 1))"
    echo "New version: $NEW"
    jq --tab --arg v "$NEW" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
    pnpm lint:fix >/dev/null
    git add package.json
    git commit -m "chore(release): bump version to $NEW"
    git tag "v$NEW"
    echo ""
    echo "Created tag v$NEW"
    echo ""
    echo "Push with:"
    echo "  git push origin main --tags"

# Bump minor version (0.1.2 → 0.2.0)
bump-minor:
    #!/bin/sh
    set -e
    CURRENT=$(jq -r '.version' package.json)
    echo "Current version: $CURRENT"
    MAJOR=$(echo "$CURRENT" | cut -d. -f1)
    MINOR=$(echo "$CURRENT" | cut -d. -f2)
    NEW="$MAJOR.$((MINOR + 1)).0"
    echo "New version: $NEW"
    jq --tab --arg v "$NEW" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
    pnpm lint:fix >/dev/null
    git add package.json
    git commit -m "chore(release): bump version to $NEW"
    git tag "v$NEW"
    echo ""
    echo "Created tag v$NEW"
    echo ""
    echo "Push with:"
    echo "  git push origin main --tags"

# Bump major version (0.1.2 → 1.0.0)
bump-major:
    #!/bin/sh
    set -e
    CURRENT=$(jq -r '.version' package.json)
    echo "Current version: $CURRENT"
    MAJOR=$(echo "$CURRENT" | cut -d. -f1)
    NEW="$((MAJOR + 1)).0.0"
    echo "New version: $NEW"
    jq --tab --arg v "$NEW" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
    pnpm lint:fix >/dev/null
    git add package.json
    git commit -m "chore(release): bump version to $NEW"
    git tag "v$NEW"
    echo ""
    echo "Created tag v$NEW"
    echo ""
    echo "Push with:"
    echo "  git push origin main --tags"

# Release: bump patch, push, and trigger release workflow
release-patch: bump-patch
    git push origin main --tags

# Release: bump minor, push, and trigger release workflow
release-minor: bump-minor
    git push origin main --tags

# Release: bump major, push, and trigger release workflow
release-major: bump-major
    git push origin main --tags
