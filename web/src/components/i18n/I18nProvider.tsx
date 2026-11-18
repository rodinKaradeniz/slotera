"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useHydrated } from "@/lib/use-hydrated";
import { readSession } from "@/lib/session";
import { dataSource } from "@/lib/env";
import { getLanguagePreference, saveLanguagePreference } from "@/services/preferences.service";
import type { Messages } from "@/i18n/messages/en";
import {
  isLangLoaded,
  loadLang,
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
  const pathname = usePathname();
  const operatorSurface = pathname?.startsWith("/admin") || pathname?.startsWith("/superadmin") || false;
  const hydrated = useHydrated();
  const [chosen, setChosen] = React.useState<Lang | null>(null);
  const wanted = chosen ?? (hydrated ? readLang() : "en");
  // Turkish and German load on demand; until they arrive the page stays in English,
  // exactly as it already does between the server render and hydration.
  const [, setLoadedCount] = React.useState(0);
  React.useEffect(() => {
    if (isLangLoaded(wanted)) return;
    let active = true;
    loadLang(wanted).then(() => { if (active) setLoadedCount((count) => count + 1); }).catch(() => undefined);
    return () => { active = false; };
  }, [wanted]);
  const lang = isLangLoaded(wanted) ? wanted : "en";

  const [saveError, setSaveError] = React.useState<string | null>(null);
  const userId = React.useSyncExternalStore(
    React.useCallback((notify) => {
      window.addEventListener("slotera-session-change", notify);
      window.addEventListener("storage", notify);
      return () => { window.removeEventListener("slotera-session-change", notify); window.removeEventListener("storage", notify); };
    }, []), () => readSession()?.operator.id ?? null, () => null);
  const sequence = React.useRef(0);
  React.useEffect(() => {
    if (dataSource !== "api" || !userId || !operatorSurface) return;
    let active = true;
    const requested = sequence.current;
    getLanguagePreference().then((language) => {
      if (active && requested === sequence.current) { setChosen(language); writeLang(language); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [userId, operatorSurface]);
  const setLang = React.useCallback((next: Lang) => {
    const apply = () => {
      const previous = readLang();
      const request = ++sequence.current;
      setChosen(next); writeLang(next); setSaveError(null);
      if (dataSource === "api" && operatorSurface && readSession()) {
        saveLanguagePreference(next).catch(() => {
          if (request === sequence.current) {
            setChosen(previous); writeLang(previous);
            setSaveError(translate(previous, "language.saveFailed"));
          }
        });
      }
    };
    // Switch once the messages are here, so the page goes straight to the new language.
    if (isLangLoaded(next)) apply();
    else loadLang(next).then(apply).catch(() => undefined);
  }, [operatorSurface]);

  // The root layout renders lang="en"; keep the attribute in step with the chosen language.
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = React.useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  return (
    <I18nContext.Provider value={value}>{operatorSurface && saveError && <p role="alert" className="p-3 text-danger">{saveError}</p>}{children}</I18nContext.Provider>
  );
}
