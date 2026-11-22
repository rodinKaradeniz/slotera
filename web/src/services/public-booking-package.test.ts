import { beforeEach, expect, it, vi } from "vitest";
import { EMPTY_DRAFT, type BookingDraft } from "@/components/booking/types";
import type { Service } from "@/types/service";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/env", () => ({ dataSource: "api" }));
vi.mock("@/api/client", () => ({ apiRequest: request }));
import { createPublicBooking } from "./public-booking.service";

const draft: BookingDraft = {
  ...EMPTY_DRAFT,
  service: { id: "svc", priceCents: 38000 } as Service,
  startAt: "2035-01-05T10:00:00Z",
  customer: { ...EMPTY_DRAFT.customer, firstName: "Pat", lastName: "Client", email: "pat@example.com", consent: true },
};
beforeEach(() => {
  request.mockReset();
  // The first call lists the service's forms; the second creates the booking.
  request.mockImplementation(async (path: string) => (path.endsWith("/forms") ? { items: [] } : { id: "bkg" }));
});

it("books a paid service with the signed-in client's package: no billing, client credentials", async () => {
  await createPublicBooking({ ...draft, packagePurchaseId: "pur" }, "lena");
  const [path, options] = request.mock.calls[1];
  expect(path).toBe("/public/workspaces/lena/bookings");
  expect(options).toMatchObject({ method: "POST", authKind: "client", csrf: true });
  expect(options.body).toMatchObject({ paymentMethod: "package", packagePurchaseId: "pur", billingAddress: null });
});

it("pays as usual when no package is chosen", async () => {
  await createPublicBooking({ ...draft, packagePurchaseId: null }, "lena");
  const [, options] = request.mock.calls[1];
  expect(options.authKind).toBeUndefined();
  expect(options.body).toMatchObject({ paymentMethod: "manual", packagePurchaseId: null });
  expect(options.body.billingAddress).not.toBeNull();
});
