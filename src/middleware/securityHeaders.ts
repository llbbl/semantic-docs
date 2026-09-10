/**
 * Headers a `<meta http-equiv>` cannot carry. Referrer-Policy is the exception
 * and reaches prerendered pages through `<meta name="referrer">` in the layout;
 * it is repeated here so on-demand routes carry it as a real header too.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
};

/** Fill in what a route left unset; a value it already chose wins, so the API routes keep their stricter policy. */
export function applySecurityHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (headers.has(name)) continue;

    try {
      headers.set(name, value);
    } catch {
      // Response.redirect() and friends return immutable headers, where set()
      // throws. Serving the response without these beats failing the request.
      return;
    }
  }
}
