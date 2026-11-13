"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { ClientsView } from "@/components/admin/clients/ClientsView";

export default function ClientsPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.clients") }]);
  return <ClientsView />;
}
