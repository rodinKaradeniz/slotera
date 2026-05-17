"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { SettingsView } from "@/components/admin/settings/SettingsView";

export default function SettingsPage() {
  useSetCrumbs([{ label: "Settings" }]);
  return <SettingsView />;
}
