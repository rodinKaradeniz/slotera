"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { DashboardView } from "@/components/admin/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <AdminShell crumbs={[{ label: "Dashboard" }]}>
      <DashboardView />
    </AdminShell>
  );
}
