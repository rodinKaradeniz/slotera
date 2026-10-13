"use client";

import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
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
  // "en" on the server and during hydration, then the persisted choice, so the first
  // client render matches the server's.
  const hydrated = useHydrated();
  const [chosen, setChosen] = React.useState<Lang | null>(null);
  const lang = chosen ?? (hydrated ? readLang() : "en");

  const setLang = React.useCallback((next: Lang) => {
    setChosen(next);
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
