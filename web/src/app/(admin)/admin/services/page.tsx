"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { ServicesView } from "@/components/admin/services/ServicesView";

export default function ServicesPage() {
  useSetCrumbs([{ label: "Services" }]);
  return <ServicesView />;
}
