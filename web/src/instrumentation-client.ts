import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Browser errors and sampled page loads. No Session Replay: it would record client
// names and emails on screen.
if (sentryOptions.dsn) Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
