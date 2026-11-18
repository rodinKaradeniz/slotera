import { INTERFACE_KEYS } from "@/i18n/interface-keys";
import { en, type Messages } from "@/i18n/messages/en";

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

// English ships with every page and is the fallback. Turkish and German are each about
// a third of the copy, so they load only for someone who uses them (see `loadLang`).
const DICTS: Partial<Record<Lang, Partial<Messages>>> = { en };
const LOADERS: Record<Exclude<Lang, "en">, () => Promise<Partial<Messages>>> = {
  tr: () => import("@/i18n/messages/tr").then((module) => module.tr),
  de: () => import("@/i18n/messages/de").then((module) => module.de),
};

export function isLangLoaded(lang: Lang): boolean {
  return lang in DICTS;
}

/** Fetch a language's messages once; `translate` falls back to English until then. */
export async function loadLang(lang: Lang): Promise<void> {
  if (lang === "en" || isLangLoaded(lang)) return;
  DICTS[lang] = await LOADERS[lang]();
}

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
  const dict = DICTS[lang] ?? en;
  let value = dict[key] ?? en[key] ?? (key as string);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return value;
}

/** Translate static shared metadata labels; never apply to consultant-authored content. */
export function translateInterfaceLabel(lang: Lang, label: string): string {
  const key = INTERFACE_KEYS[label];
  return key ? translate(lang, key) : label;
}
