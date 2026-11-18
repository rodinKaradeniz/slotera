import { describe, expect, it } from "vitest";
import { availableSlots, bookingOutcome, isPubliclyBookable, paymentMethodFor, quoteFor } from "./public-booking-rules";
import type { AvailabilitySettings } from "@/services/settings.service";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";

const service = (patch: Partial<Service> = {}): Service => ({
  id: "svc", name: "Call", description: "", durationMin: 60, priceCents: 12000, currency: "GBP", capacity: 1,
  locationType: "online", location: "Zoom", bookingMode: "open", confirmationPolicy: "automatic",
  cancellationRule: "", active: true, createdAtISO: "", ...patch,
});

const policy: AvailabilitySettings = {
  timezone: "Europe/London",
  // Monday 09:00 to 12:00 only.
  weeklyHours: [{ dayOfWeek: 1, startLocal: "09:00", endLocal: "12:00" }],
  slotIntervalMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0,
  minimumNoticeMin: 60, maximumAdvanceDays: 90, customerChangeNoticeHours: 24, blackouts: [],
};

const session = (patch: Partial<SessionItem>): SessionItem => ({
  id: "s", serviceId: "svc", startISO: "", endISO: "", capacity: 1, bookedCount: 0,
  status: "scheduled", locationType: "online", location: "Zoom", ...patch,
} as SessionItem);

// Sunday 2026-11-22 08:00 UTC; Monday 2026-11-23 is the only working day in range.
const now = new Date("2026-11-22T08:00:00Z");
const times = (slots: { startAt: string }[]) => slots.map((slot) => slot.startAt.slice(11, 16));

describe("public booking rules (mirrors the server)", () => {
  it("lists open 1:1 and scheduled services only", () => {
    expect(isPubliclyBookable(service())).toBe(true);
    expect(isPubliclyBookable(service({ bookingMode: "scheduled", capacity: 8 }))).toBe(true);
    expect(isPubliclyBookable(service({ capacity: 4 }))).toBe(false);
    expect(isPubliclyBookable(service({ active: false }))).toBe(false);
  });

  it("extracts a fixed tax from the gross price instead of adding it", () => {
    const tax = { taxTreatment: "fixed" as const, taxRateBps: 2000, taxLabel: "VAT", taxJurisdiction: "GB" };
    expect(quoteFor(12000, tax)).toMatchObject({ grossAmountCents: 12000, netAmountCents: 10000, taxAmountCents: 2000, label: "VAT" });
    expect(quoteFor(12000, { ...tax, taxTreatment: "none" })).toMatchObject({ netAmountCents: 12000, taxAmountCents: 0, label: undefined });
  });

  it("steps through working hours and leaves room for the whole session", () => {
    const slots = availableSlots(service(), policy, [], "2026-11-23", "2026-11-23", now);
    expect(times(slots)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("drops slots that overlap a session or a buffered blackout, and respects notice", () => {
    const busy = session({ id: "x", serviceId: "other", startISO: "2026-11-23T10:00:00Z", endISO: "2026-11-23T11:00:00Z" });
    const slots = availableSlots(service(), { ...policy, blackouts: [{ startsAt: "2026-11-23T11:30:00Z", endsAt: "2026-11-23T12:00:00Z" }] },
      [busy, session({ startISO: "2026-11-23T09:00:00Z", endISO: "2026-11-23T10:00:00Z", status: "cancelled" })],
      "2026-11-23", "2026-11-23", now);
    expect(times(slots)).toEqual(["09:00"]);
    const soon = availableSlots(service(), policy, [], "2026-11-23", "2026-11-23", new Date("2026-11-23T09:10:00Z"));
    expect(times(soon)).toEqual(["10:30", "11:00"]);
  });

  it("offers the operator's scheduled sessions that still have seats", () => {
    const workshop = service({ bookingMode: "scheduled", capacity: 6 });
    const slots = availableSlots(workshop, policy, [
      session({ id: "a", startISO: "2026-11-25T15:00:00Z", endISO: "2026-11-25T17:00:00Z", capacity: 6, bookedCount: 4 }),
      session({ id: "b", startISO: "2026-11-26T15:00:00Z", endISO: "2026-11-26T17:00:00Z", capacity: 6, bookedCount: 6 }),
      session({ id: "c", startISO: "2026-11-01T15:00:00Z", endISO: "2026-11-01T17:00:00Z", capacity: 6, bookedCount: 0 }),
    ], "2026-11-01", "2026-11-30", now);
    expect(slots).toEqual([{ startAt: "2026-11-25T15:00:00Z", endAt: "2026-11-25T17:00:00Z", spotsLeft: 2 }]);
  });

  it("accepts free for £0 and manual only when enabled", () => {
    expect(paymentMethodFor(0, false)).toBe("free");
    expect(paymentMethodFor(5000, true)).toBe("manual");
    expect(paymentMethodFor(5000, false)).toBeNull();
  });

  it("confirms only free bookings that need no approval", () => {
    const start = "2026-11-23T09:00:00Z";
    expect(bookingOutcome(service(), "free", start, now)).toMatchObject({ status: "confirmed", pendingReasons: [], paymentDueAt: null });
    expect(bookingOutcome(service({ confirmationPolicy: "operator_approval" }), "manual", start, now)).toMatchObject({
      status: "pending", pendingReasons: ["approval", "payment"], paymentStatus: "pending",
      // Due by the session start, which comes before now + 48 hours.
      paymentDueAt: "2026-11-23T09:00:00.000Z",
    });
  });
});
