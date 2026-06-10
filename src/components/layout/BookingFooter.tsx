"use client";

import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/components/i18n/I18nProvider";

export function BookingFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line-soft mt-12">
      <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-micro">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="lock" size={12} /> {t("booking.footer.secure")}
        </span>
        <span className="flex items-center gap-4">
          <Link href="#" className="hover:text-ink">{t("legal.tab.terms")}</Link>
          <Link href="#" className="hover:text-ink">{t("legal.tab.privacy")}</Link>
          <Link href="#" className="hover:text-ink">{t("legal.tab.imprint")}</Link>
        </span>
      </div>
    </footer>
  );
}
