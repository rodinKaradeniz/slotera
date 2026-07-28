"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { OverviewView } from "@/components/superadmin/OverviewView";

export default function SuperadminOverviewPage() {
  useSetCrumbs([{ label: "Platform" }, { label: "Overview" }]);
  return <OverviewView />;
}
