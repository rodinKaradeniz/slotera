import { expect, it } from "vitest";
import { countUpFrame } from "./CountUp";

it("counts grouped whole numbers in place, keeping currency and separators", () => {
  expect(countUpFrame("£8,420", 0)).toBe("£0");
  expect(countUpFrame("£8,420", 0.5)).toBe("£4,210");
  expect(countUpFrame("£8,420", 1)).toBe("£8,420");
  expect(countUpFrame("8.420 €", 0.5)).toBe("4.210 €");
  expect(countUpFrame("47", 0.5)).toBe("24");
});

it("leaves labels without a whole number alone", () => {
  expect(countUpFrame("New this month", 0.5)).toBeNull();
  expect(countUpFrame("£179.50", 0.5)).toBeNull();
  expect(countUpFrame("4,5 %", 0.5)).toBeNull();
});
