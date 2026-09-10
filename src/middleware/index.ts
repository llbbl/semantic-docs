import { defineMiddleware } from 'astro:middleware';
import { applySecurityHeaders } from './securityHeaders';

// Only on-demand routes reach this at request time; the adapter's static
// handler serves prerendered pages without it, so those rely on the proxy.
// No CSP header here: a second policy intersects with the per-page <meta> one
// rather than replacing it, blocking the hashes that element authorizes.
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  applySecurityHeaders(response.headers);
  return response;
});
