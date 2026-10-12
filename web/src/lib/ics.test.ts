import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, icsTime } from "./ics";

const EVENT = {
  reference: "SLT-AB12",
  startISO: "2026-11-03T14:00:00+01:00",
  endISO: "2026-11-03T14:50:00+01:00",
  title: "Discovery Call with Dr. Lena Hartmann",
  location: "Studio 4, 1 Main St; London",
  description: "Reference: SLT-AB12\nTo change or cancel, use your email link.",
};

describe("ics", () => {
  it("writes UTC times", () => {
    expect(icsTime("2026-11-03T14:00:00+01:00")).toBe("20261103T130000Z");
  });

  it("matches the server's event format", () => {
    const ics = buildIcs(EVENT, new Date("2026-10-11T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("UID:slt-ab12@slotera.io\r\n");
    expect(ics).toContain("DTSTART:20261103T130000Z\r\nDTEND:20261103T135000Z\r\n");
    expect(ics).toContain("LOCATION:Studio 4\\, 1 Main St\; London\r\n");
    expect(ics).toContain("DESCRIPTION:Reference: SLT-AB12\\nTo change");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long lines without splitting characters", () => {
    const title = "Sitzung mit Ünal Öztürk ".repeat(8);
    const ics = buildIcs({ ...EVENT, title });
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${title}`);
  });

  it("builds a prefilled Google Calendar link", () => {
    const url = new URL(googleCalendarUrl(EVENT));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261103T130000Z/20261103T135000Z");
    expect(url.searchParams.get("text")).toBe(EVENT.title);
    expect(url.searchParams.get("location")).toBe(EVENT.location);
  });
});
