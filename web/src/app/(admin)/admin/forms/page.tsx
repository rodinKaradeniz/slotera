"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { FormsView } from "@/components/admin/forms/FormsView";

export default function FormsPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.forms") }]);
  return <FormsView />;
}
