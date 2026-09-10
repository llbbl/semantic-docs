# Security Considerations

## API Rate Limiting

The search API (`/api/search.json`) includes built-in rate limiting to prevent abuse:

### Default Limits
- **20 requests per minute** per resolved client identity
- **500 character** maximum query length
- **20 results** maximum per query
- **10,000** in-memory rate limit buckets per server process by default

### Rate Limit Headers
All API responses include standard rate limit headers:
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1700000000
```

### Rate Limit Exceeded (429)
When rate limited, the API returns:
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 42
}
```

With headers:
```
Retry-After: 42
X-RateLimit-Remaining: 0
```

### Client Identity and Trusted Proxies

By default, the rate limiter ignores `X-Forwarded-For` and `X-Real-IP` because
clients can spoof those headers. Requests are bucketed by the direct client
address reported by the Astro server adapter. If no direct address is available,
the limiter uses a shared `unknown` bucket instead of creating a unique
unlimited bucket per request.

Enable proxy-derived identity only when the application is reachable exclusively
through trusted infrastructure that overwrites or safely appends the selected
header:

```bash
RATE_LIMIT_TRUSTED_PROXY_HEADER=x-real-ip
# or
RATE_LIMIT_TRUSTED_PROXY_HEADER=x-forwarded-for
RATE_LIMIT_TRUSTED_PROXY_HOPS=1
```

Use `x-real-ip` when your proxy overwrites it with exactly one validated client
address. Use `x-forwarded-for` only when your proxy strips untrusted incoming
values or appends to a chain you understand. `RATE_LIMIT_TRUSTED_PROXY_HOPS`
counts trusted proxy entries from the right side of the `X-Forwarded-For` chain;
the limiter uses the nearest untrusted address before those hops. For example:

```text
X-Forwarded-For: 203.0.113.10, 198.51.100.20, 198.51.100.21
RATE_LIMIT_TRUSTED_PROXY_HOPS=1 -> 198.51.100.20
RATE_LIMIT_TRUSTED_PROXY_HOPS=2 -> 203.0.113.10
```

Malformed proxy headers are rejected and fall back to the direct client address
or the shared `unknown` bucket. Unsupported values for
`RATE_LIMIT_TRUSTED_PROXY_HEADER` leave proxy trust disabled.

## Deployment Considerations

### Single Server (Current Implementation)
- In-memory rate limiting
- Works for: Node.js server deployments and serverless functions
- Limitation: Each process or function instance has its own counter
- Expired entries are cleaned opportunistically on requests; no background
  interval is kept alive
- The bucket store is bounded by `RATE_LIMIT_MAX_ENTRIES` and evicts the bucket
  with the earliest reset time when full

### Production Recommendations

For multi-server deployments, consider:

1. **Redis-based rate limiting**
   ```bash
   pnpm add ioredis
   ```

2. **Edge rate limiting** (Platform-specific)
   - Vercel: Use Edge Config or KV
   - Netlify: Use Blobs

3. **WAF/CDN rate limiting**
   - AWS CloudFront: Lambda@Edge
   - Fastly: VCL rate limiting

### Query Cost Protection

The API limits:
- Query length (500 chars) - prevents expensive embedding generation
- Results count (max 20) - prevents excessive database queries
- Request rate (20/min) - prevents API/database abuse

A per-process result cache sits in front of the embedding call, so repeated
queries cost nothing upstream. It is keyed by normalized query and limit, holds
500 entries for 5 minutes by default, and is tuned with
`SEARCH_CACHE_TTL_SECONDS` and `SEARCH_CACHE_MAX_ENTRIES`. Setting the TTL to 0
disables it. The cache is per instance, so it reduces call volume rather than
bounding it; it is not a substitute for a spend cap.

### Environment-Specific Risks

**Cloudflare Workers AI embedding provider**
- Risk: Quota and cost. Every search and every indexed document is a billable
  Workers AI call against a shared account-wide allowance. The in-memory rate
  limit is per-IP and per-instance, so it caps neither a distributed source nor
  total account spend.
- Risk: Data egress. Indexed content and raw search queries are sent to
  Cloudflare. Do not index material you cannot share with a third party.
- Risk: Availability coupling. There is no in-process fallback; a Workers AI
  outage takes search down.
- Mitigation: Rate limiting bounds a single client only, and the result cache
  collapses repeated queries. Neither bounds total spend. Set a Workers AI usage
  cap in the Cloudflare dashboard for a real ceiling.
- Note: While a query is cached, results are served without contacting
  Cloudflare, so broken or revoked credentials surface only once the entry
  expires rather than on the next request.

### Credential Handling

`CLOUDFLARE_API_TOKEN` is the only secret this project sends to a third party.

- Scope it to the `Workers AI: Read` permission and nothing more
- Keep it in `.env` (gitignored) or the deployment platform's secret store
- Rotate it if it is ever printed, committed, or shared
- The token is never returned to clients: credential errors surface as a
  generic 500, and libsql-search redacts the token from its own error paths

### Turso Database Limits

Free tier limits:
- 500 databases
- 9 GB total storage
- Unlimited rows read
- Unlimited rows written

**Cost protection**: Rate limiting prevents write abuse from malicious indexing attempts.

## Browser Security Headers

Coverage is split because `output: 'server'` prerenders article pages to static
files. The Node adapter serves those from disk without running middleware, so
anything that has to reach a prerendered page must be baked into its HTML or
added by whatever sits in front of the app.

### What the app sets

**Content-Security-Policy** — as a `<meta http-equiv>` element in the `<head>`
of every page, generated by Astro's `security.csp` (see `astro.config.mjs`).
Astro hashes the inline scripts and styles it emits itself; the inline theme
prepaint script is authorized by a hash derived from the script text in
`src/config/themeCsp.ts`, so editing a theme regenerates the hash rather than
invalidating a pinned one.

```
default-src 'self';
base-uri 'self';
form-action 'none';
object-src 'none';
frame-src 'none';
img-src 'self' data: https:;
script-src 'self' <per-build sha256 hashes>;
style-src 'self' <per-build sha256 hashes>;
```

Neither `script-src` nor `style-src` carries `'unsafe-inline'` or
`'unsafe-eval'`. `img-src` admits `https:` and `data:` because `sanitize-html`
permits those schemes on markdown `<img>`; a site that only ships local images
can tighten it to `'self'`.

Astro does not emit the element under `astro dev`, because the Vite dev server
injects styles and HMR client code that no build-time hash can cover. Verify
policy changes with `pnpm build` followed by `pnpm preview` or `pnpm start`.

**Referrer-Policy**, **Permissions-Policy**, **X-Content-Type-Options** and
**X-Frame-Options** — set by `src/middleware/index.ts` on responses Astro
renders on demand: the search and health endpoints, and any page whose route
does not set `prerender = true`. The middleware fills in a header only when the
route did not already set one, so the API routes keep their stricter
`default-src 'none'` policy.

`Permissions-Policy`, `X-Content-Type-Options` and `X-Frame-Options` have no
`<meta>` delivery mechanism, so on prerendered pages they must come from the
edge. **Referrer-Policy is the exception**: `<meta name="referrer">` is a
spec-defined mechanism supported across browsers, and `DocsLayout.astro` sets it
on every page, prerendered included. It is `http-equiv="Referrer-Policy"` that
browsers ignore — a different attribute.

### What the operator must set at the edge

Prerendered pages get none of the header-only protections, and two directives
are meaningless in a `<meta>` element regardless. Set these on the reverse
proxy, CDN, or platform edge config:

- `Strict-Transport-Security` — the app never knows whether it is behind TLS.
- `Content-Security-Policy: frame-ancestors` — ignored in `<meta>`. Until this
  is set, `X-Frame-Options` is the only clickjacking defense, and only on
  on-demand routes.
- `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`,
  `X-Frame-Options` — duplicated here so prerendered pages get them too.

nginx:

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
```

`add_header` does not accumulate across levels: a `location` block that declares
any `add_header` of its own discards every inherited one. Repeat these in each
such block — a `location /_astro/` setting `Cache-Control` for the hashed assets
is the usual one to miss, and testing only `/` will not reveal it.

Caddy:

```caddy
header {
  Strict-Transport-Security "max-age=63072000; includeSubDomains"
  Content-Security-Policy "frame-ancestors 'none'"
  Referrer-Policy "strict-origin-when-cross-origin"
  Permissions-Policy "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  X-Content-Type-Options "nosniff"
  X-Frame-Options "DENY"
}
```

A `frame-ancestors` sent as a header is additive with the `<meta>` policy: both
apply, and the strictest wins. Do not send a full `Content-Security-Policy`
header covering `script-src` or `style-src` from the proxy — a second policy
intersects with the meta policy rather than replacing it, and a generic
`script-src 'self'` would block the hashed inline scripts the pages depend on.

### Known gap: search dialog scroll lock

`react-remove-scroll`, pulled in through Radix Dialog by the cmdk search
palette, injects a `<style>` element at runtime whose contents include the
measured scrollbar width. That width is browser- and platform-dependent, so the
stylesheet cannot be hashed at build time and `style-src` blocks it. The browser
logs a CSP violation when the palette opens.

`'unsafe-inline'` is not a way out. Per the CSP spec browsers ignore it whenever
a hash is present in the same directive, and Astro always hashes its own inline
styles, so adding the keyword leaves the stylesheet blocked and changes nothing.
The only configuration that would unblock it is one with no style hashes at all.

The lock itself is recovered without touching the policy. `react-remove-scroll`
sets `data-scroll-locked` on `<body>` from a separate effect — a DOM attribute
write, which CSP does not govern — so `src/styles/global.css` keys the
`overflow: hidden` off that attribute, and `scrollbar-gutter: stable` stands in
for the scrollbar-width compensation that is not reproducible without the
runtime measurement. The library's document-level `wheel` and `touchmove`
handlers are unaffected either way; note that they do not intercept keyboard
scrolling or scrollbar dragging, which is what the CSS rule restores.

## Additional Security Measures

### Optional Enhancements

1. **CORS restrictions**
   ```ts
   headers: {
     'Access-Control-Allow-Origin': 'https://yourdomain.com'
   }
   ```

2. **Referer checking** (weak but simple)
   ```ts
   const referer = request.headers.get('referer');
   if (!referer?.includes('yourdomain.com')) {
     return new Response('Forbidden', { status: 403 });
   }
   ```

3. **API Keys** (for private docs)
   ```ts
   const apiKey = request.headers.get('x-api-key');
   if (apiKey !== process.env.SEARCH_API_KEY) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

4. **Query caching**
   ```ts
   // Cache common queries to reduce database load
   const cacheKey = `search:${query}`;
   const cached = await cache.get(cacheKey);
   if (cached) return cached;
   ```

## Monitoring

Recommended metrics to track:
- Requests per IP
- 429 (rate limited) responses
- Query patterns
- Response times
- Database query counts
- Embedding provider usage

Consider setting up alerts for:
- Spike in 429 responses
- Unusually long queries
- High request volume from single IP
