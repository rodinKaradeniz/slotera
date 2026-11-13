"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

/** Last resort when the root layout itself fails; it has no providers, so plain English. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t: uiText } = useI18n();
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1>{uiText("ui.something.went.wrong")}</h1>
        <p>{uiText("ui.the.problem.has.been.reported.please.try.again")}</p>
        <button type="button" onClick={reset}>
          {uiText("ui.try.again")}</button>
      </body>
    </html>
  );
}
