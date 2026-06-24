"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { PackagesView } from "@/components/admin/packages/PackagesView";

export default function PackagesPage() {
  useSetCrumbs([{ label: "Packages" }]);
  return <PackagesView />;
}
