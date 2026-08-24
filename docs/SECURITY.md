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

### Environment-Specific Risks

**Local embedding provider** (Free)
- Risk: CPU abuse
- Mitigation: Rate limiting sufficient

### Turso Database Limits

Free tier limits:
- 500 databases
- 9 GB total storage
- Unlimited rows read
- Unlimited rows written

**Cost protection**: Rate limiting prevents write abuse from malicious indexing attempts.

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
