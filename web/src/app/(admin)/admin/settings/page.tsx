"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { SettingsView } from "@/components/admin/settings/SettingsView";

export default function SettingsPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.settings") }]);
  return <SettingsView />;
}
