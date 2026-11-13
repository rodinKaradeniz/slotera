"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { PackagesView } from "@/components/admin/packages/PackagesView";

export default function PackagesPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.packages") }]);
  return <PackagesView />;
}
