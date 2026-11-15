import { beforeEach, afterEach, expect, it, vi } from "vitest";

beforeEach(() => {vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");});
afterEach(() => vi.unstubAllEnvs());
it("cancels active demo attendees without changing terminal history or payment", async () => {
  const sessions = await import("./sessions.service");
  const bookings = await import("./bookings.service");
  const ledger = await bookings.listBookings();
  const active = ledger.find((booking) => ["pending", "confirmed"].includes(booking.status))!;
  const previous = await bookings.listBookingsBySession(active.sessionId);
  const occurrence = (await sessions.getSession(active.sessionId))!;
  await sessions.cancelSession(occurrence.id, occurrence.version);
  const after = await bookings.listBookingsBySession(occurrence.id);
  for (const item of previous) {
    const result = after.find((entry) => entry.id === item.id)!;
    expect(result.status).toBe(["pending", "confirmed"].includes(item.status) ? "cancelled" : item.status);
    expect(result.paymentStatus).toBe(item.paymentStatus);
    expect(result.amountCents).toBe(item.amountCents);
  }
  expect((await sessions.getSession(occurrence.id))?.bookedCount).toBe(0);
});
it("rejects demo capacity loss, historical service changes and stale writes", async () => {
  const sessions = await import("./sessions.service");
  const bookings = await import("./bookings.service");
  const booked = (await bookings.listBookings()).find((item) => ["pending", "confirmed"].includes(item.status))!;
  const occurrence = (await sessions.getSession(booked.sessionId))!;
  await expect(sessions.updateSession(occurrence.id, {serviceId: "different-service"}, "this", occurrence.version)).rejects.toMatchObject({code: "session_service_in_use"});
  const group = (await sessions.listSessions()).find((item) => item.bookedCount > 1)!;
  expect(group).toBeDefined();
  await expect(sessions.updateSession(group.id, {capacity: 1}, "this", group.version)).rejects.toMatchObject({code: "session_capacity_in_use"});
  const next = await sessions.updateSession(occurrence.id, {capacity: Math.max(2, occurrence.capacity + 1)}, "this", occurrence.version);
  await expect(sessions.updateSession(occurrence.id, {location: "stale"}, "this", occurrence.version)).rejects.toMatchObject({code: "resource_stale"});
  expect((await sessions.getSession(occurrence.id))?.version).toBe(next.version);
});
