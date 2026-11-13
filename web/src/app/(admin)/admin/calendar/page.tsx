"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { CalendarView } from "@/components/admin/calendar/CalendarView";

export default function CalendarPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.calendar") }]);
  return <CalendarView />;
}
