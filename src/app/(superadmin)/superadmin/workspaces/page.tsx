"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { WorkspacesView } from "@/components/superadmin/WorkspacesView";

export default function SuperadminWorkspacesPage() {
  useSetCrumbs([{ label: "Platform" }, { label: "Workspaces" }]);
  return <WorkspacesView />;
}
