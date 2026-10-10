"use client";

import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/components/i18n/I18nProvider";

/** `branded` is false for Professional workspaces: no "Powered by Slotera". */
export function BookingFooter({ branded = true }: { branded?: boolean }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line-soft mt-12">
      <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-micro">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="lock" size={12} /> {t(branded ? "booking.footer.secure" : "booking.footer.secureOnly")}
        </span>
        <span className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-ink">{t("legal.tab.terms")}</Link>
          <Link href="/privacy" className="hover:text-ink">{t("legal.tab.privacy")}</Link>
        </span>
      </div>
    </footer>
  );
}
