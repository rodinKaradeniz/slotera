import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";
import { CURRENCIES } from "@/types/common";

describe("formatMoney", () => {
  it("formats every supported currency from minor units", () => {
    expect(formatMoney(1900, "GBP")).toBe("£19.00");
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
    // EUR uses German grouping; normalise the narrow no-break space Intl emits.
    expect(formatMoney(123456, "EUR").replace(/\s/g, " ")).toBe("1.234,56 €");
  });

  it("defaults to GBP", () => {
    expect(formatMoney(0)).toBe("£0.00");
  });

  it("has a formatter for each currency a workspace may use", () => {
    for (const currency of CURRENCIES) {
      expect(() => formatMoney(100, currency)).not.toThrow();
    }
  });
});
