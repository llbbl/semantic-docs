# Security Considerations

## API Rate Limiting

The search API (`/api/search.json`) includes built-in rate limiting to prevent abuse:

### Default Limits
- **20 requests per minute** per IP address
- **500 character** maximum query length
- **20 results** maximum per query

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

## Deployment Considerations

### Single Server (Current Implementation)
- In-memory rate limiting
- Works for: Netlify, Vercel serverless functions
- Limitation: Each function instance has its own counter

### Production Recommendations

For multi-server deployments, consider:

1. **Redis-based rate limiting**
   ```bash
   pnpm add ioredis
   ```

2. **Edge rate limiting** (Platform-specific)
   - Cloudflare Workers: Use Durable Objects
   - Vercel: Use Edge Config or KV
   - Netlify: Use Blobs

3. **WAF/CDN rate limiting**
   - Cloudflare: Configure rate limiting rules
   - AWS CloudFront: Lambda@Edge
   - Fastly: VCL rate limiting

### Query Cost Protection

The API limits:
- Query length (500 chars) - prevents expensive embedding generation
- Results count (max 20) - prevents excessive database queries
- Request rate (20/min) - prevents API/database abuse

### Environment-Specific Risks

**Local/Xenova Provider** (Free)
- Risk: CPU abuse
- Mitigation: Rate limiting sufficient

**Gemini Provider** (Free tier: 1,500 req/day)
- Risk: API quota exhaustion
- Mitigation: Consider stricter rate limits (5-10 req/min)

**OpenAI Provider** (Paid)
- Risk: Cost abuse
- Mitigation: Monitor usage, alert on anomalies
- Recommendation: Use OpenAI's own rate limiting

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
- Embedding API usage

Consider setting up alerts for:
- Spike in 429 responses
- Unusually long queries
- High request volume from single IP
