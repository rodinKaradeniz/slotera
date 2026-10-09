import { CURRENCIES, type Currency } from "@/types/common";
import { ApiRequestError } from "./_errors";

/** Narrow an API currency string, failing loudly on one the UI can't format. */
export function apiCurrency(value: string): Currency {
  if ((CURRENCIES as readonly string[]).includes(value)) return value as Currency;
  throw new ApiRequestError(
    200,
    "unsupported_currency",
    `The API returned unsupported currency ${value}.`,
  );
}
