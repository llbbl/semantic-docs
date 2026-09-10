/**
 * Post-build smoke test.
 *
 * Boots the built server and exercises the paths the unit suite mocks around:
 * prerendered article pages, the health check, and a real search request that
 * embeds a query and reads vectors back out of the database. Its job is to fail
 * when a dependency bump breaks rendering or search, which unit tests cannot
 * see because they never run the built output.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from 'logan-logger';

const PORT = Number.parseInt(process.env.SMOKE_PORT ?? '4331', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SERVER_ENTRY = './dist/server/entry.mjs';
const STARTUP_TIMEOUT_MS = 30_000;

const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    logger.info(`ok   ${name}`);
    return;
  }
  const message = detail ? `${name} — ${detail}` : name;
  logger.error(`FAIL ${message}`);
  failures.push(message);
}

function checkPrerenderedPages(): void {
  const pages = [
    'dist/client/index.html',
    'dist/client/content/getting-started/welcome/index.html',
    'dist/client/content/features/semantic-search/index.html',
    'dist/client/content/theme/overview/index.html',
  ];

  for (const page of pages) {
    const path = resolve(process.cwd(), page);
    if (!existsSync(path)) {
      check(`prerendered ${page}`, false, 'file not emitted');
      continue;
    }

    const html = readFileSync(path, 'utf8');
    // An article page built against an empty table still emits valid HTML, so
    // presence of the file proves nothing on its own.
    check(
      `prerendered ${page}`,
      html.includes('<article') || html.includes('<main'),
      'no article or main element in output',
    );
  }
}

async function waitForServer(signal: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal.aborted) return false;
    try {
      const response = await fetch(`${BASE_URL}/api/health.json`);
      if (response.status === 200 || response.status === 503) return true;
    } catch {
      // Server not listening yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Every inline script and style in the built HTML must be authorized by that
 * page's own CSP. Source-level tests compare the hash to the script they both
 * derive from and cannot see an encoding or embedding change that makes the two
 * disagree once shipped — which breaks theming on every page, silently.
 */
function checkContentSecurityPolicy(): void {
  const pages = [
    'dist/client/index.html',
    'dist/client/content/getting-started/welcome/index.html',
  ];

  for (const page of pages) {
    const path = resolve(process.cwd(), page);
    if (!existsSync(path)) continue;

    const html = readFileSync(path, 'utf8');
    const policy = /http-equiv="content-security-policy"[^>]*content="([^"]*)"/i
      .exec(html)?.[1]
      ?.replace(/&#39;/g, "'");

    if (!policy) {
      check(`CSP present in ${page}`, false, 'no meta http-equiv found');
      continue;
    }

    check(
      `CSP in ${page} has no unsafe-inline`,
      !policy.includes('unsafe-inline') && !policy.includes('unsafe-eval'),
      policy.slice(0, 200),
    );

    const inline = [
      ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
      ...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
    ].map((match) => match[1]);

    const unauthorized = inline.filter((body) => {
      const digest = createHash('sha256').update(body, 'utf8').digest('base64');
      return !policy.includes(`sha256-${digest}`);
    });

    check(
      `every inline script and style in ${page} is hashed by its CSP`,
      unauthorized.length === 0,
      `${unauthorized.length} unauthorized of ${inline.length}`,
    );
  }
}

async function checkHealth(): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/health.json`);
  const body = (await response.json()) as {
    status?: string;
    checks?: { database?: boolean; embeddings?: boolean };
  };

  check(
    'GET /api/health.json reports ok',
    response.status === 200 && body.status === 'ok',
    `status ${response.status}, body ${JSON.stringify(body)}`,
  );
}

async function checkSearch(): Promise<void> {
  // Presence, not rank. Under the offline provider the vectors carry no
  // semantics, so ordering is not a property worth asserting; that the indexed
  // article comes back at all is what proves the round trip. The limit is the
  // API maximum so the check does not quietly become a rank assertion, and so a
  // coin flip, once the corpus grows past a handful of articles.
  const query = 'semantic search embeddings';
  const expectedSlug = 'features/semantic-search';
  const response = await fetch(`${BASE_URL}/api/search.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 20 }),
  });

  if (response.status !== 200) {
    const text = await response.text();
    check(
      'POST /api/search.json returns 200',
      false,
      `status ${response.status}: ${text.slice(0, 300)}`,
    );
    return;
  }

  const body = (await response.json()) as {
    results?: Array<{ slug?: string; title?: string }>;
  };
  const results = body.results ?? [];

  check('POST /api/search.json returns results', results.length > 0, 'empty');
  check(
    'search results carry a slug and title',
    results.every((r) => Boolean(r.slug) && Boolean(r.title)),
    JSON.stringify(results.slice(0, 2)),
  );
  check(
    `search finds ${expectedSlug}`,
    results.some((r) => r.slug === expectedSlug),
    `got ${JSON.stringify(results.map((r) => r.slug))}`,
  );
}

async function main(): Promise<void> {
  checkPrerenderedPages();
  checkContentSecurityPolicy();

  if (!existsSync(resolve(process.cwd(), SERVER_ENTRY))) {
    check(`${SERVER_ENTRY} exists`, false, 'run pnpm build first');
    process.exit(1);
  }

  const server = spawn('node', [SERVER_ENTRY], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const exited = new AbortController();
  server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      logger.error(`Server exited early with code ${code}`);
    }
    exited.abort();
  });
  // An unhandled 'error' event throws instead of producing a FAIL line.
  server.on('error', (error) => {
    check('server process starts', false, String(error));
    exited.abort();
  });

  try {
    if (!(await waitForServer(exited.signal))) {
      check('server responds on /api/health.json', false, 'startup timed out');
      return;
    }

    await checkHealth();
    await checkSearch();
  } finally {
    server.kill('SIGTERM');
  }
}

await main();

if (failures.length > 0) {
  logger.error(`Smoke test failed: ${failures.length} check(s)`);
  process.exit(1);
}

logger.info('Smoke test passed');
process.exit(0);
