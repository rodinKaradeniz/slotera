"use client";

import * as React from "react";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { BookingsView } from "@/components/admin/bookings/BookingsView";

export default function BookingsPage() {
  useSetCrumbs([{ label: "Bookings" }]);
  return (
    <React.Suspense fallback={null}>
      <BookingsView />
    </React.Suspense>
  );
}
