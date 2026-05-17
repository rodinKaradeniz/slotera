"use client";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { CalendarView } from "@/components/admin/calendar/CalendarView";

export default function CalendarPage() {
  useSetCrumbs([{ label: "Calendar" }]);
  return <CalendarView />;
}
