import { describe, expect, it } from "vitest";
import { localDateKey, slotParts } from "./calendar";

describe("availability date keys", () => {
  it("keys a calendar cell by its local date, not a UTC timestamp", () => {
    // Regression: cells were compared by full ISO timestamps, so no day ever matched.
    expect(localDateKey(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(localDateKey(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01");
  });

  it("puts a slot on the workspace's local date", () => {
    // 22:30 UTC on 12 Oct is already 13 Oct in Istanbul (UTC+3).
    expect(slotParts("2026-10-12T22:30:00Z", "Europe/Istanbul")).toEqual({
      date: "2026-10-13",
      time: "01:30",
    });
    expect(slotParts("2026-10-12T22:30:00Z", "Europe/London")).toEqual({
      date: "2026-10-12",
      time: "23:30",
    });
  });

  it("matches cell keys for the same local day", () => {
    const slot = slotParts("2026-03-29T09:00:00Z", "UTC");
    expect(slot.date).toBe(localDateKey(new Date(2026, 2, 29)));
  });
});
