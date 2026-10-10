import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Next.js server and edge (proxy) errors.
export function register() {
  if (sentryOptions.dsn) Sentry.init(sentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
