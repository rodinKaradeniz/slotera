"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { OverviewView } from "@/components/superadmin/OverviewView";

export default function SuperadminOverviewPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.platform") }, { label: uiText("ui.overview") }]);
  return <OverviewView />;
}
