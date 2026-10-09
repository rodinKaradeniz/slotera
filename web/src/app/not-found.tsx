"use client";

import Link from "next/link";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <StatusScreen
      icon="search"
      eyebrow={t("system.notFound.eyebrow")}
      title={t("system.notFound.title")}
      body={t("system.notFound.body")}
    >
      <Link href="/">
        <Button variant="primary" icon="arrow-left">
          {t("system.notFound.home")}
        </Button>
      </Link>
    </StatusScreen>
  );
}
