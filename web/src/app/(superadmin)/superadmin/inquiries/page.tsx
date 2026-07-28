"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { InquiriesView } from "@/components/superadmin/InquiriesView";

export default function SuperadminInquiriesPage() {
  useSetCrumbs([{ label: "Platform" }, { label: "Inquiries" }]);
  return <InquiriesView />;
}
