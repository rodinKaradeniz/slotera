"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { ServicesView } from "@/components/admin/services/ServicesView";

export default function ServicesPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.services") }]);
  return <ServicesView />;
}
