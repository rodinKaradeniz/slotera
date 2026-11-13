import { readLang, localeForLang, type Lang } from "@/lib/i18n";
import type { Currency } from "@/types/common";

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  GBP: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
};

export function formatMoney(cents: number, currency: Currency = "GBP", lang?: Lang): string {
  lang ??= readLang();
  return (lang !== "en" ? new Intl.NumberFormat(localeForLang(lang), { style: "currency", currency }) : FORMATTERS[currency]).format(cents / 100);
}

export function gbp(cents: number): string {
  return formatMoney(cents, "GBP");
}
