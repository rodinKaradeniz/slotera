"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { SubscriptionsView } from "@/components/superadmin/SubscriptionsView";

export default function SuperadminSubscriptionsPage() {
  useSetCrumbs([{ label: "Platform" }, { label: "Subscriptions" }]);
  return <SubscriptionsView />;
}
