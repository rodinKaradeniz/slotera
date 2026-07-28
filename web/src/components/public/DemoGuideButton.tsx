"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useDemoGuide } from "./DemoGuideProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

type Variant = "link" | "ghost";

type Props = {
  /** Visual style of the trigger. `link` is a quiet text link, `ghost` is a pill button. */
  variant?: Variant;
  className?: string;
};

/**
 * Quiet trigger for the shared Demo Guide modal. The modal instance + auto-open
 * behaviour live in `DemoGuideProvider`; this is just one of several triggers.
 */
export function DemoGuideButton({ variant = "link", className }: Props) {
  const { open } = useDemoGuide();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "inline-flex items-center gap-1.5 select-none",
        variant === "link"
          ? "text-[14px] text-ink-2 hover:text-ink"
          : "h-9 px-3 rounded-md border border-line bg-surface text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink transition-colors",
        className,
      )}
      aria-label={t("landing.nav.demo")}
    >
      {t("landing.nav.demo")}
    </button>
  );
}
