"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { CalendarView } from "@/components/admin/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <AdminShell crumbs={[{ label: "Calendar" }]}>
      <CalendarView />
    </AdminShell>
  );
}
