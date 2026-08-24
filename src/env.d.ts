/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly TURSO_DB_URL?: string;
  readonly TURSO_AUTH_TOKEN?: string;
  readonly RATE_LIMIT_TRUSTED_PROXY_HEADER?: string;
  readonly RATE_LIMIT_TRUSTED_PROXY_HOPS?: string;
  readonly RATE_LIMIT_MAX_ENTRIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
