"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { BookingsView } from "@/components/admin/bookings/BookingsView";

export default function BookingsPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.bookings") }]);
  return (
    <React.Suspense fallback={null}>
      <BookingsView />
    </React.Suspense>
  );
}
