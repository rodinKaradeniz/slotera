"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { BookingsView } from "@/components/admin/bookings/BookingsView";

export default function BookingsPage() {
  return (
    <AdminShell crumbs={[{ label: "Bookings" }]}>
      <BookingsView />
    </AdminShell>
  );
}
