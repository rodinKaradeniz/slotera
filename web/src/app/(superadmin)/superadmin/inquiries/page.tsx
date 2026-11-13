"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useSetCrumbs } from "@/components/layout/PageMeta";
import { InquiriesView } from "@/components/superadmin/InquiriesView";

export default function SuperadminInquiriesPage() {
  const { t: uiText } = useI18n();
  useSetCrumbs([{ label: uiText("ui.platform") }, { label: uiText("ui.inquiries") }]);
  return <InquiriesView />;
}
