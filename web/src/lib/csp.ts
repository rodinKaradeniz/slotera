/**
 * A Content-Security-Policy for the web app, sent report-only first (docs/TODO.md).
 * Inline scripts and styles stay allowed until Next.js nonces are set up; the policy
 * still blocks foreign scripts, frames, plugins and unexpected request targets.
 */
export function buildCsp(apiBaseUrl: string): string {
  let apiOrigin = "";
  try {
    apiOrigin = new URL(apiBaseUrl).origin;
  } catch {
    // An unparsable API URL just leaves connect-src at 'self'.
  }
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
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
