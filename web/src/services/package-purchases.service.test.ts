import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock"); });
afterEach(() => vi.unstubAllEnvs());

it("shows the demo sale with the bookings that hold its sessions", async () => {
  const { listClientPackagePurchases } = await import("./package-purchases.service");
  const [sale] = await listClientPackagePurchases("cli-005");
  expect(sale).toMatchObject({ packageName: "Strategy Sprint Package", paymentStatus: "paid", usedCount: 2, remainingCount: 1 });
  expect(sale.items.map((item) => item.booking?.id ?? null)).toEqual([null, "bkg-1008", "bkg-1002"]);
  expect(await listClientPackagePurchases("cli-001")).toEqual([]);
});

it("books with a sale, gives the session back on cancel, and stops after a void", async () => {
  const purchases = await import("./package-purchases.service");
  const bookings = await import("./bookings.service");
  const sale = await purchases.recordPackageSale("cli-005", { packageId: "pkg-coaching-4", paymentReceived: false }, "sale-1");
  expect(sale).toMatchObject({ paymentStatus: "pending", remainingCount: 4, priceCents: 88000 });
  expect((await purchases.recordPackageSale("cli-005", { packageId: "pkg-coaching-4", paymentReceived: false }, "sale-1")).id).toBe(sale.id);
  await expect(purchases.recordPackageSale("cli-005", { packageId: "pkg-strategy-sprint", paymentReceived: false }, "sale-1"))
    .rejects.toMatchObject({ code: "idempotency_key_reused" });

  const input = { clientId: "cli-005", sessionId: "ses-006", packagePurchaseId: sale.id, auditReason: "Package", sendEmail: false, language: "en" as const };
  const booked = await bookings.createOperatorBooking(input, "book-1");
  expect(booked).toMatchObject({ paymentMethod: "package", paymentStatus: "paid", status: "confirmed", amountCents: 0, packagePosition: 1 });
  expect((await purchases.packagesCovering("cli-005", "svc-sprint")).map((item) => item.id)).toContain(sale.id);
  // The older sale has no sprint left, so it doesn't cover a sprint.
  expect((await purchases.packagesCovering("cli-005", "svc-sprint")).map((item) => item.id)).not.toContain("pur-001");

  await bookings.cancelBooking(booked.id);
  const [afterCancel] = (await purchases.listClientPackagePurchases("cli-005")).filter((item) => item.id === sale.id);
  expect(afterCancel.usedCount).toBe(0);

  const paid = await purchases.markPackagePaid(sale.id, sale.version);
  expect(paid.paymentStatus).toBe("paid");
  await expect(purchases.markPackagePaid(sale.id, sale.version)).rejects.toMatchObject({ code: "resource_stale" });
  const voided = await purchases.voidPackagePurchase(sale.id, paid.version);
  expect(voided).toMatchObject({ status: "voided", remainingCount: 0 });
  await expect(bookings.createOperatorBooking(input, "book-2")).rejects.toMatchObject({ code: "package_voided" });
});

it("won't delete a package that was sold", async () => {
  const { removePackage } = await import("./packages.service");
  await expect(removePackage("pkg-strategy-sprint")).rejects.toMatchObject({ code: "package_in_use" });
});
