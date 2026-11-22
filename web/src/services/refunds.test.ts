import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock"); });
afterEach(() => vi.unstubAllEnvs());

it("adds up booking refunds and marks the payment refunded once all is back", async () => {
  const { getBooking, recordBookingRefund, refundableCents } = await import("./bookings.service");
  const paid = (await getBooking("bkg-1001"))!;
  expect(refundableCents(paid)).toBe(38000);
  const partial = await recordBookingRefund(paid.id, 19000);
  expect(partial).toMatchObject({ paymentStatus: "paid", refundedCents: 19000 });
  await expect(recordBookingRefund(paid.id, 19001)).rejects.toMatchObject({ code: "booking_refund_invalid" });
  const full = await recordBookingRefund(paid.id, 19000);
  expect(full).toMatchObject({ paymentStatus: "refunded", refundedCents: 38000 });
  expect(refundableCents(full)).toBe(0);
});

it("has nothing to refund on a package session, an unpaid booking or a free one", async () => {
  const { getBooking, recordBookingRefund, refundableCents } = await import("./bookings.service");
  for (const id of ["bkg-1002", "bkg-1004", "bkg-1006"]) {
    expect(refundableCents((await getBooking(id))!)).toBe(0);
    await expect(recordBookingRefund(id, 1)).rejects.toMatchObject({ code: "booking_refund_invalid" });
  }
});

it("refunds a paid sale up to its price, also after a void", async () => {
  const purchases = await import("./package-purchases.service");
  const [sale] = await purchases.listClientPackagePurchases("cli-005");
  const voided = await purchases.voidPackagePurchase(sale.id, sale.version);
  await expect(purchases.refundPackagePurchase(sale.id, voided.version, sale.priceCents + 1))
    .rejects.toMatchObject({ code: "package_refund_invalid" });
  const refunded = await purchases.refundPackagePurchase(sale.id, voided.version, 10000);
  expect(refunded).toMatchObject({ status: "voided", refundedCents: 10000 });
  expect(purchases.saleRefundableCents(refunded)).toBe(sale.priceCents - 10000);
  await expect(purchases.refundPackagePurchase(sale.id, voided.version, 100)).rejects.toMatchObject({ code: "resource_stale" });
});
