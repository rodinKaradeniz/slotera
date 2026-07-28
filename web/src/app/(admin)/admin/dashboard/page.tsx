"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { DashboardView } from "@/components/admin/dashboard/DashboardView";

export default function DashboardPage() {
  useSetCrumbs([{ label: "Dashboard" }]);
  return <DashboardView />;
}
