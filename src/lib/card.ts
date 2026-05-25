/**
 * Pure helpers for parsing and live-formatting the mock card form fields used
 * by the registration payment step and the Settings → Billing → Update card
 * modal. Strictly client-side / mock only; nothing here should ship into a
 * real payments integration (use Stripe Elements there).
 */

/** First-digit-of-PAN brand detection. Adequate for the mock UI. */
export function detectCardBrand(num: string): string {
  const raw = num.replace(/\s/g, "");
  if (raw.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(raw)) return "Mastercard";
  if (/^3[47]/.test(raw)) return "Amex";
  return "Card";
}

/**
 * Live-format a card-number string into groups of 4. Strips non-digits, caps
 * at 16 digits + 3 spaces. Idempotent — running it on already-formatted input
 * leaves it unchanged.
 */
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join(" ");
}

/**
 * Live-format an expiration into `MM / YY`. Strips non-digits, inserts the
 * separator once the second digit is typed. The space-padded slash is a
 * deliberate stylistic choice — matches modern checkout flows and reads
 * cleanly with monospace digits.
 */
export function formatCardExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

/** Live-format CVC: digits only, max 4 chars. */
export function formatCardCvc(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

/**
 * Returns true when the expiration field is well-formed.
 * Accepts both `MM/YY` (legacy) and `MM / YY` (current spaced format) so
 * callers don't have to care which they receive.
 */
export function isValidCardExpiry(value: string): boolean {
  return /^\d{2}\s*\/\s*\d{2}$/.test(value.trim());
}

/** Parse an expiration string into a `{ month, year }` (year as 4-digit). */
export function parseCardExpiry(value: string): { month: number; year: number } {
  const [mm, yy] = value.split("/").map((s) => Number(s.trim()));
  return {
    month: mm || 1,
    year: yy ? 2000 + yy : new Date().getFullYear() + 1,
  };
}
