import { readLang } from "@/lib/i18n";
export function plural(
  count: number,
  singular: string,
  pluralForm?: string,
): string {
  const lang = readLang();
  const nouns: Record<string, [string, string, string]> = {
    booking: ["rezervasyon", "Buchung", "Buchungen"], session: ["seans", "Sitzung", "Sitzungen"],
    client: ["müşteri", "Kunde", "Kunden"], service: ["hizmet", "Leistung", "Leistungen"],
    package: ["paket", "Paket", "Pakete"], form: ["form", "Formular", "Formulare"],
  };
  const translated = nouns[singular];
  if (translated && lang !== "en") return `${count} ${lang === "tr" ? translated[0] : translated[count === 1 ? 1 : 2]}`;
  const word = count === 1 ? singular : pluralForm ?? `${singular}s`;
  return `${count} ${word}`;
}

/** Lowercase URL slug: letters/digits joined by single hyphens (matches the API's slug rule). */
export function slugify(value: string): string {
  return value
    // Letters NFKD can't reduce to ASCII, from the supported languages (TR, DE).
    .replace(/ı/g, "i")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
