import { describe, expect, it } from "vitest";
import {
  detectCardBrand,
  formatCardCvc,
  formatCardExpiry,
  formatCardNumber,
  isValidCardExpiry,
  parseCardExpiry,
} from "./card";

describe("card helpers", () => {
  it("detects the brand from the first digits", () => {
    expect(detectCardBrand("4242 4242")).toBe("Visa");
    expect(detectCardBrand("5555")).toBe("Mastercard");
    expect(detectCardBrand("3782")).toBe("Amex");
    expect(detectCardBrand("9")).toBe("Card");
  });

  it("groups the number in fours, strips letters and caps at 16 digits", () => {
    expect(formatCardNumber("4242a42424242424242999")).toBe("4242 4242 4242 4242");
    expect(formatCardNumber(formatCardNumber("42424"))).toBe("4242 4");
  });

  it("formats the expiry as MM / YY and validates both spellings", () => {
    expect(formatCardExpiry("1")).toBe("1");
    expect(formatCardExpiry("1228")).toBe("12 / 28");
    expect(isValidCardExpiry("12 / 28")).toBe(true);
    expect(isValidCardExpiry("12/28")).toBe(true);
    expect(isValidCardExpiry("1228")).toBe(false);
    expect(parseCardExpiry("12 / 28")).toEqual({ month: 12, year: 2028 });
  });

  it("keeps the CVC to four digits", () => {
    expect(formatCardCvc("12a345")).toBe("1234");
  });
});
