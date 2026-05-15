"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsView } from "@/components/admin/settings/SettingsView";

export default function SettingsPage() {
  return (
    <AdminShell crumbs={[{ label: "Settings" }]}>
      <SettingsView />
    </AdminShell>
  );
}
