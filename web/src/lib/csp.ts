/** Production scripts require a per-document nonce; existing React styles remain allowed. */
export function buildCsp(apiBaseUrl: string, nonce: string): string {
  let apiOrigin = "";
  try {
    apiOrigin = new URL(apiBaseUrl).origin;
  } catch {
    // An unparsable API URL just leaves connect-src at 'self'.
  }
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    // Sentry events are tunnelled through this origin (/monitoring); the API is a separate host.
    "connect-src": ["'self'", ...(apiOrigin ? [apiOrigin] : [])],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}
