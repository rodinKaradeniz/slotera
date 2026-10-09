"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PublicBookingFlow } from "@/components/booking/PublicBookingFlow";
import { setPublicWorkspaceSlug } from "@/services/public-booking.service";
import { dataSource } from "@/lib/env";

export default function WorkspaceBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  // Selected during render, not in an effect: the flow's children fetch the
  // workspace in their own effects, which run before this component's.
  setPublicWorkspaceSlug(dataSource === "api" ? slug : null);
  React.useEffect(() => () => setPublicWorkspaceSlug(null), []);
  return <PublicBookingFlow />;
}
