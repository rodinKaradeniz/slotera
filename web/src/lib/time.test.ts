import { describe, expect, it } from "vitest";
import { addMinutes, fmtDate, fmtRelative, parseTime } from "./time";

describe("time helpers", () => {
  it("parses HH:mm", () => {
    expect(parseTime("09:30")).toEqual({ h: 9, m: 30 });
  });

  it("adds minutes and wraps past midnight", () => {
    expect(addMinutes("09:30", 45)).toBe("10:15");
    expect(addMinutes("23:30", 60)).toBe("00:30");
    expect(addMinutes("00:10", -20)).toBe("23:50");
  });

  it("formats dates", () => {
    expect(fmtDate(new Date(2026, 9, 5))).toBe("5 October 2026");
    expect(fmtDate(new Date(2026, 9, 5), "short")).toBe("5 Oct 2026");
  });

  it("describes an instant relative to now", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(fmtRelative("2026-10-05T12:30:00Z", now)).toBe("in 30m");
    expect(fmtRelative("2026-10-05T10:00:00Z", now)).toBe("2h ago");
    expect(fmtRelative("2026-10-05T14:15:00Z", now)).toBe("in 2h 15m");
    expect(fmtRelative("2026-10-08T12:00:00Z", now)).toBe("in 3d");
  });
});
