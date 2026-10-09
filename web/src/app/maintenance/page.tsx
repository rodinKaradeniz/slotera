"use client";

import { StatusScreen } from "@/components/layout/StatusScreen";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

// Served for every route by `src/proxy.ts` while MAINTENANCE_MODE=1.
export default function MaintenancePage() {
  const { t } = useI18n();
  return (
    <StatusScreen
      icon="cog"
      eyebrow={t("system.maintenance.eyebrow")}
      title={t("system.maintenance.title")}
      body={t("system.maintenance.body")}
    >
      <Button variant="secondary" icon="refresh" onClick={() => window.location.reload()}>
        {t("system.maintenance.retry")}
      </Button>
    </StatusScreen>
  );
}
