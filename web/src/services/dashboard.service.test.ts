import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The demo fixtures move so their "today" lands on the real today; a fixed clock pins that
// day to Wednesday 18 November 2026, 12:00 in the demo workspace (Europe/Berlin).
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T11:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("builds today's schedule from the demo sessions, their live bookings and the clock", async () => {
  const { getDashboard } = await import("./dashboard.service");
  const data = await getDashboard();

  expect(data.timezone).toBe("Europe/Berlin");
  expect(data.todayISO).toBe("2026-11-18T00:00:00.000Z");
  expect(data.todaySchedule.map((item) => [item.id, item.status, item.time, item.client])).toEqual([
    ["ses-001", "past", "09:30", "Mila Ozawa"],
    ["ses-002", "next", "13:00", "Sofia Marin"],
    ["ses-003", "upcoming", "16:30", "No booking yet"],
  ]);
  expect(data.nextSession).toMatchObject({ id: "ses-002", status: "next", bookingId: "bkg-1002" });
  // Monday 16 to Sunday 22 November: the three today plus three later this week.
  expect(data.weekSessionCount).toBe(6);
  // The fixture's KPI labels are replaced by the visitor's language.
  const { translate } = await import("@/lib/i18n");
  expect(data.kpis.map((kpi) => kpi.label)).toEqual(
    (["dashboard.revenue", "dashboard.bookings", "dashboard.clients", "dashboard.average"] as const).map((key) => translate("en", key)),
  );
});

it("leaves out cancelled sessions and never names a client from a cancelled booking", async () => {
  const sessions = await import("./sessions.service");
  const bookings = await import("./bookings.service");
  const { getDashboard } = await import("./dashboard.service");
  const next = (await sessions.getSession("ses-002"))!;
  await sessions.cancelSession(next.id, next.version);
  // ses-001 keeps an older cancelled booking (Pieter de Vries) beside the live one.
  await bookings.cancelBooking("bkg-1001");

  const data = await getDashboard();
  expect(data.todaySchedule.map((item) => [item.id, item.status, item.client])).toEqual([
    ["ses-001", "past", "No booking yet"],
    ["ses-003", "next", "No booking yet"],
  ]);
  expect(data.nextSession?.id).toBe("ses-003");
  expect(data.weekSessionCount).toBe(5);
});
