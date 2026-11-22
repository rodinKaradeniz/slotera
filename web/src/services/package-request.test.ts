// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserStorage } from "@/test/browser-storage";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
  vi.stubGlobal("localStorage", browserStorage());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("records a demo package request for an existing client, awaiting payment, once per key", async () => {
  const purchases = await import("./package-purchases.service");
  const buyer = { firstName: "Sofia", lastName: "Marin", email: "Sofia.Marin@lambdaco.es" };
  const result = await purchases.requestPackage("pkg-coaching-4", buyer, "buy-1");
  expect(result).toMatchObject({ paymentStatus: "pending", sessionCount: 4, priceCents: 88000 });
  expect((await purchases.requestPackage("pkg-coaching-4", buyer, "buy-1")).id).toBe(result.id);
  await expect(purchases.requestPackage("pkg-strategy-sprint", buyer, "buy-1")).rejects.toMatchObject({ code: "idempotency_key_reused" });
  const mine = await purchases.listClientPackagePurchases("cli-005");
  expect(mine.find((item) => item.id === result.id)).toMatchObject({ paymentStatus: "pending", remainingCount: 4 });
});

it("adds a new buyer to the demo clients", async () => {
  const purchases = await import("./package-purchases.service");
  const clients = await import("./clients.service");
  await purchases.requestPackage("pkg-coaching-4", { firstName: "New", lastName: "Buyer", email: "new.buyer@example.com" }, "buy-2");
  const buyer = (await clients.listClients()).find((item) => item.email === "new.buyer@example.com");
  expect(buyer).toMatchObject({ name: "New Buyer", tag: "new" });
  expect(await purchases.listClientPackagePurchases(buyer!.id)).toHaveLength(1);
});
