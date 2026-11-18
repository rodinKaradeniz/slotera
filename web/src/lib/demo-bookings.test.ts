// @vitest-environment jsdom
import { expect, it } from "vitest";
import { listBookings } from "@/services/bookings.service";
import { listClients } from "@/services/clients.service";
import { listSessions } from "@/services/sessions.service";
import { saveDemoBooking } from "./demo-bookings";
import { DATA_CHANGED } from "@/api/query-cache";

it("shows a booking made on the demo booking page in the demo admin stores", async () => {
  let refreshed = 0;
  window.addEventListener(DATA_CHANGED, () => refreshed++);
  const booking = {
    id: "demo-1", sessionId: "ses-demo-1", clientId: "cli-demo-1", status: "pending" as const,
    paymentStatus: "pending" as const, amountCents: 12000, currency: "EUR" as const, createdAtISO: "2026-11-18T09:00:00.000Z",
  };
  saveDemoBooking({
    booking,
    client: { id: "cli-demo-1", name: "Ada Visitor", email: "ada@example.com", tag: "new", joinedISO: booking.createdAtISO,
      totalBookings: 1, completedBookings: 0, cancelledBookings: 0, totalSpentCents: 0 },
    session: { id: "ses-demo-1", serviceId: "svc-deepdive", startISO: "2026-11-20T09:00:00.000Z", endISO: "2026-11-20T10:00:00.000Z",
      capacity: 1, bookedCount: 1, status: "scheduled", locationType: "online", location: "Zoom", recurring: "one-off" },
  });

  expect((await listBookings()).filter((item) => item.id === "demo-1")).toHaveLength(1);
  expect((await listClients()).some((item) => item.email === "ada@example.com")).toBe(true);
  expect((await listSessions()).some((item) => item.id === "ses-demo-1")).toBe(true);
  expect(refreshed).toBe(1);
});

it("takes a seat in an existing session instead of adding one", async () => {
  const before = (await listSessions()).find((item) => item.id === "ses-001")!;
  saveDemoBooking({
    booking: { id: "demo-2", sessionId: "ses-001", clientId: "cli-001", status: "confirmed", paymentStatus: "free",
      amountCents: 0, currency: "EUR", createdAtISO: "2026-11-18T09:00:00.000Z" },
    client: null,
    session: null,
  });
  const after = (await listSessions()).find((item) => item.id === "ses-001")!;
  expect(after.bookedCount).toBe(before.bookedCount + 1);
  const client = (await listClients()).find((item) => item.id === "cli-001")!;
  expect(client.totalBookings).toBeGreaterThan(7);
});
