import { describe, expect, it } from "vitest";
import { clockIn, localDateKey, sessionOverlaps, slotParts, zonedWallToISO } from "./calendar";

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

describe("session overlap detection", () => {
  const existing = [
    {
      id: "s1",
      startISO: "2030-01-10T09:00:00Z",
      endISO: "2030-01-10T10:00:00Z",
      status: "scheduled" as const,
    },
    {
      id: "s2",
      startISO: "2030-01-10T12:00:00Z",
      endISO: "2030-01-10T13:00:00Z",
      status: "cancelled" as const,
    },
  ];

  it("finds a session that partly overlaps the candidate", () => {
    const hit = sessionOverlaps(
      { startISO: "2030-01-10T09:30:00Z", endISO: "2030-01-10T10:30:00Z" },
      existing,
    );
    expect(hit?.id).toBe("s1");
  });

  it("lets sessions touch end to start", () => {
    expect(
      sessionOverlaps({ startISO: "2030-01-10T10:00:00Z", endISO: "2030-01-10T11:00:00Z" }, existing),
    ).toBeNull();
  });

  it("ignores cancelled sessions and the session being edited", () => {
    expect(
      sessionOverlaps({ startISO: "2030-01-10T12:15:00Z", endISO: "2030-01-10T12:45:00Z" }, existing),
    ).toBeNull();
    expect(
      sessionOverlaps(
        { id: "s1", startISO: "2030-01-10T09:00:00Z", endISO: "2030-01-10T10:00:00Z" },
        existing,
      ),
    ).toBeNull();
  });
});

describe("zoned wall clock", () => {
  it("shows an instant as the workspace clock reads", () => {
    expect(clockIn("2026-07-01T08:00:00.000Z", "Europe/Berlin")).toBe("10:00");
    expect(clockIn("2026-01-01T08:00:00.000Z", "Europe/Berlin")).toBe("09:00");
    expect(clockIn("2026-07-01T08:00:00.000Z", "UTC")).toBe("08:00");
  });

  it("turns a workspace wall time back into the UTC instant", () => {
    expect(zonedWallToISO("2026-07-01", "10:00", "Europe/Berlin")).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedWallToISO("2026-01-01", "10:00", "Europe/Berlin")).toBe("2026-01-01T09:00:00.000Z");
    expect(zonedWallToISO("2026-07-01", "10:00", "UTC")).toBe("2026-07-01T10:00:00.000Z");
  });

  it("round-trips across a DST change", () => {
    const iso = zonedWallToISO("2026-03-29", "09:30", "Europe/Berlin");
    expect(clockIn(iso, "Europe/Berlin")).toBe("09:30");
  });
});
