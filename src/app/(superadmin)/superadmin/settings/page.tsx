"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { SuperadminSettingsView } from "@/components/superadmin/SettingsView";

export default function SuperadminSettingsPage() {
  useSetCrumbs([{ label: "Platform" }, { label: "Settings" }]);
  return <SuperadminSettingsView />;
}
