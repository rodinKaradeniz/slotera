"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { WorkspaceDetailView } from "@/components/superadmin/WorkspaceDetailView";

export default function SuperadminWorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  useSetCrumbs([
    { label: "Platform" },
    { label: "Workspaces", href: "/superadmin/workspaces" },
    { label: "Detail" },
  ]);
  return <WorkspaceDetailView id={id} />;
}
