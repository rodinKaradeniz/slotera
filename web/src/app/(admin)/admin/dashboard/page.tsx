"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { DashboardView } from "@/components/admin/dashboard/DashboardView";

export default function DashboardPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.dashboard") }]);
  return <DashboardView />;
}
