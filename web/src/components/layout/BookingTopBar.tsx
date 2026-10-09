"use client";

import * as React from "react";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { PublicNav } from "@/components/layout/PublicNav";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";
import { dataSource } from "@/lib/env";

type Props = {
  /** The workspace being booked with, when known. */
  consultantName?: string;
};

/**
 * Header for pages a client sees (booking, confirmation, manage). Clients belong to
 * the operator, so the real app shows no Slotera marketing navigation here; the demo
 * keeps `PublicNav` because its visitors are evaluating Slotera itself.
 */
export function BookingTopBar({ consultantName }: Props) {
  const { t } = useI18n();
  if (dataSource === "mock") return <PublicNav />;
  return (
    <header className="border-b border-line-soft">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-4">
        {consultantName ? (
          <span className="text-[15px] text-ink font-medium truncate">{consultantName}</span>
        ) : (
          <Logo />
        )}
        <div className="flex-1" />
        <LanguageSwitcher className="hidden sm:inline-flex" />
        <span className="hidden sm:inline-flex items-center gap-1.5 text-micro text-ink-3">
          <Icon name="lock" size={12} /> {t("booking.topbar.secure")}
        </span>
      </div>
    </header>
  );
}
