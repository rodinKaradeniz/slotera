"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { WorkspacesView } from "@/components/superadmin/WorkspacesView";

export default function SuperadminWorkspacesPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.platform") }, { label: uiText("ui.workspaces") }]);
  return <WorkspacesView />;
}
