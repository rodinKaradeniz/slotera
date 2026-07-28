"use client";

import * as React from "react";
import type { Messages } from "@/i18n/messages/en";
import {
  readLang,
  writeLang,
  translate,
  type Lang,
} from "@/lib/i18n";

type T = (
  key: keyof Messages,
  vars?: Record<string, string | number>,
) => string;

type Ctx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
};

const I18nContext = React.createContext<Ctx | null>(null);

export function useI18n(): Ctx {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start from "en" for a stable server/first-client render, then hydrate the
  // persisted choice in an effect to avoid a hydration mismatch.
  const [lang, setLangState] = React.useState<Lang>("en");

  React.useEffect(() => {
    setLangState(readLang());
  }, []);

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next);
    writeLang(next);
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}
