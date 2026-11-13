"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useParams } from "next/navigation";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { WorkspaceDetailView } from "@/components/superadmin/WorkspaceDetailView";

export default function SuperadminWorkspaceDetailPage() {
  const { t: uiText } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  useSetCrumbs([
    { label: uiText("ui.platform") },
    { label: uiText("ui.workspaces"), href: "/superadmin/workspaces" },
    { label: uiText("ui.detail") },
  ]);
  return <WorkspaceDetailView id={id} />;
}
