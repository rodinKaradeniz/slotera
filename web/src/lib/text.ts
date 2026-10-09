export function plural(
  count: number,
  singular: string,
  pluralForm?: string,
): string {
  const word = count === 1 ? singular : pluralForm ?? `${singular}s`;
  return `${count} ${word}`;
}

/** Lowercase URL slug: letters/digits joined by single hyphens (matches the API's slug rule). */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
