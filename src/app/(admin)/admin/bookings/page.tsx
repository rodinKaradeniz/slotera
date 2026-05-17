"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { BookingsView } from "@/components/admin/bookings/BookingsView";

export default function BookingsPage() {
  useSetCrumbs([{ label: "Bookings" }]);
  return <BookingsView />;
}
