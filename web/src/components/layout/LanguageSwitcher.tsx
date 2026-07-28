"use client";

import * as React from "react";
import { SegGroup } from "@/components/ui/SegGroup";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LANGS, type Lang } from "@/lib/i18n";

/** Compact EN / TR / DE switcher. Persists to localStorage via the provider. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <SegGroup<Lang>
      value={lang}
      onChange={setLang}
      options={LANGS}
      size="sm"
      className={className}
    />
  );
}
