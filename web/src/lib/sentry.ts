import type * as Sentry from "@sentry/nextjs";

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;
type ErrorEvent = Parameters<NonNullable<Options["beforeSend"]>>[0];
type TransactionEvent = Parameters<NonNullable<Options["beforeSendTransaction"]>>[0];
type SpanJSON = Parameters<NonNullable<Options["beforeSendSpan"]>>[0];

// Shared Sentry options for the browser, Node and edge runtimes. Sentry is off unless
// NEXT_PUBLIC_SENTRY_DSN is set at build time, and only the real app's image gets one,
// so the mock demo never reports (docs/DEPLOYMENT.md, Monitoring).

/** Drops the query string and fragment: manage links carry their token after `#`,
 *  reset links after `?token=`, and search terms are client names. */
export function stripUrl(value: string): string {
  return value.replace(/[?#][\s\S]*$/, "");
}

// Attribute keys that can hold a URL or part of one: url, http.url, url.full,
// http.query, http.fragment, and navigation breadcrumbs' from/to.
const URL_KEY = /url|query|fragment|^from$|^to$/i;

function scrubData(data: Record<string, unknown> | undefined): void {
  for (const [key, value] of Object.entries(data ?? {})) {
    if (URL_KEY.test(key) && typeof value === "string") data![key] = stripUrl(value);
  }
}

export function scrubEvent<T extends ErrorEvent | TransactionEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = stripUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
  }
  for (const crumb of event.breadcrumbs ?? []) scrubData(crumb.data);
  // Spans inside a transaction event; standalone spans go through scrubSpan.
  if (event.type === "transaction") event.spans?.forEach(scrubSpan);
  return event;
}

export function scrubSpan(span: SpanJSON): SpanJSON {
  if (span.description) span.description = stripUrl(span.description);
  scrubData(span.data);
  return span;
}

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  // A tenth of page loads and requests; well inside the free plan's span quota.
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent<ErrorEvent>,
  beforeSendTransaction: scrubEvent<TransactionEvent>,
  beforeSendSpan: scrubSpan,
};
