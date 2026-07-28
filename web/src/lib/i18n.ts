import { en, type Messages } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { de } from "@/i18n/messages/de";

export type Lang = "en" | "tr" | "de";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "tr", label: "TR" },
  { value: "de", label: "DE" },
];

const LANG_KEY = "slotera.lang";

/** BCP-47 locale used for `Intl` date / number formatting per UI language. */
const LOCALES: Record<Lang, string> = {
  en: "en-GB",
  tr: "tr-TR",
  de: "de-DE",
};

export function localeForLang(lang: Lang): string {
  return LOCALES[lang];
}

const DICTS: Record<Lang, Partial<Messages>> = { en, tr, de };

function isBrowser() {
  return typeof window !== "undefined";
}

export function readLang(): Lang {
  if (!isBrowser()) return "en";
  try {
    const raw = window.localStorage.getItem(LANG_KEY);
    if (raw === "en" || raw === "tr" || raw === "de") return raw;
  } catch {
    // ignore
  }
  return "en";
}

export function writeLang(lang: Lang): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
}

/**
 * Translate a key for the given language. Falls back to English, then to the
 * key itself. Supports simple `{name}` interpolation.
 */
export function translate(
  lang: Lang,
  key: keyof Messages,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[lang];
  let value = dict[key] ?? en[key] ?? (key as string);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return value;
}
