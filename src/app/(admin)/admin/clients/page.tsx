"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { ClientsView } from "@/components/admin/clients/ClientsView";

export default function ClientsPage() {
  return (
    <AdminShell crumbs={[{ label: "Clients" }]}>
      <ClientsView />
    </AdminShell>
  );
}
