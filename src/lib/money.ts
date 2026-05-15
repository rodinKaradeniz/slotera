import type { Currency } from "@/types/common";

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  GBP: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
};

export function formatMoney(cents: number, currency: Currency = "EUR"): string {
  return FORMATTERS[currency].format(cents / 100);
}

export function eur(cents: number): string {
  return formatMoney(cents, "EUR");
}
