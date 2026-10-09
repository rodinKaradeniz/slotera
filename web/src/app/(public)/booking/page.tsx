"use client";

import { notFound } from "next/navigation";
import { PublicBookingFlow } from "@/components/booking/PublicBookingFlow";
import { dataSource } from "@/lib/env";

// The demo booking flow. In the real app every workspace books at /book/{slug}.
export default function BookingPage() {
  if (dataSource === "api") notFound();
  return <PublicBookingFlow />;
}
