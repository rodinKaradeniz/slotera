"use client";

import * as React from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

/** Shown when a page throws while rendering, instead of a blank screen. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <StatusScreen
      icon="info"
      eyebrow={t("system.error.eyebrow")}
      title={t("system.error.title")}
      body={t("system.error.body")}
    >
      <Button variant="primary" onClick={reset}>
        {t("system.error.retry")}
      </Button>
      <Link href="/">
        <Button variant="secondary">{t("system.notFound.home")}</Button>
      </Link>
    </StatusScreen>
  );
}
