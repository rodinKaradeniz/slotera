"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export default function NotificationsPage() {
  const { t } = useI18n();
  useSetCrumbs([{ label: t("ui.notifications") }]);
  return <NotificationsView />;
}
