"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { FormsView } from "@/components/admin/forms/FormsView";

export default function FormsPage() {
  useSetCrumbs([{ label: "Forms" }]);
  return <FormsView />;
}
