import { describe, expect, it } from "vitest";
import { PLAN_PRICES, billingState, monthsFreeYearly } from "./plans";

describe("plans", () => {
  it("prices yearly as two months free", () => {
    expect(PLAN_PRICES.map(monthsFreeYearly)).toEqual([2, 2]);
  });

  const now = new Date("2026-10-11T12:00:00Z");

  it("counts trial days left", () => {
    expect(billingState("2026-10-18T12:00:00Z", null, now)).toEqual({
      kind: "trial",
      endsISO: "2026-10-18T12:00:00Z",
      daysLeft: 7,
    });
  });

  it("prefers a paid-through date that has not passed", () => {
    expect(billingState("2026-09-01T00:00:00Z", "2026-10-11", now)).toEqual({
      kind: "paid",
      through: "2026-10-11",
    });
  });

  it("is lapsed after both the trial and the paid period end", () => {
    expect(billingState("2026-09-01T00:00:00Z", "2026-10-10", now).kind).toBe("lapsed");
    expect(billingState("2026-10-01T00:00:00Z", null, now).kind).toBe("lapsed");
  });
});
