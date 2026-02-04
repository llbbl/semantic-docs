# Just Tasks

This repository includes a `justfile` that wraps the existing `pnpm` workflows
with a more discoverable task interface.

## Install Just

Use one of the standard install methods:

- `brew install just`
- `cargo install just`

## Common Commands

- `just` to list available recipes
- `just install` to install dependencies
- `just dev` to start the dev server
- `just test` to run tests
- `just lint` to run the linter
- `just format` to format code
- `just typecheck` to run TypeScript checks
- `just build` to create a production build
- `just check` to run lint + typecheck + test
- `just ci` to mimic the CI workflow locally

## Database + Indexing

- `just db-init` to initialize the Turso schema (uses `.env`)
- `just db-init-local` to initialize the local database
- `just index` to index content to Turso (uses `.env`)
- `just index-local` to index content to the local database

## Versioning

Version tasks are managed in the `justfile`:

- `just version`
- `just bump-patch`
- `just bump-minor`
- `just bump-major`
- `just set-version`
- `just release-patch`
- `just release-minor`
- `just release-major`
