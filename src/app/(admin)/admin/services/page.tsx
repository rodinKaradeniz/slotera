"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { ServicesView } from "@/components/admin/services/ServicesView";

export default function ServicesPage() {
  return (
    <AdminShell crumbs={[{ label: "Services" }]}>
      <ServicesView />
    </AdminShell>
  );
}
