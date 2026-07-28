"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { ClientsView } from "@/components/admin/clients/ClientsView";

export default function ClientsPage() {
  useSetCrumbs([{ label: "Clients" }]);
  return <ClientsView />;
}
