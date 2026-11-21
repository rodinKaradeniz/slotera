import { mockData } from "@/services/adapters/mock-data";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Currency } from "@/types/common";
import type { PackagePurchase, PackagePurchaseItem, PackageSaleInput } from "@/types/package-purchase";
import { nextEditVersion } from "./_editing";
import { ApiRequestError, NotFoundError } from "./_errors";
import { listBookings } from "./bookings.service";
import { getPackage } from "./packages.service";
import { listServices } from "./services.service";
import { listSessions } from "./sessions.service";

type PurchaseDto = components["schemas"]["PackagePurchaseView"];

function mapPurchase(dto: PurchaseDto): PackagePurchase {
  return {
    id: dto.id, version: dto.version, clientId: dto.clientId, packageId: dto.packageId,
    packageName: dto.packageName, priceCents: dto.priceCents, currency: dto.currency as Currency,
    paymentStatus: dto.paymentStatus, paymentReceivedAtISO: dto.paymentReceivedAt ?? undefined,
    status: dto.status, voidedAtISO: dto.voidedAt ?? undefined, notes: dto.notes ?? undefined,
    items: dto.items.map((item) => ({
      position: item.position, serviceId: item.serviceId, title: item.title,
      booking: item.booking ? { id: item.booking.id, status: item.booking.status, startISO: item.booking.startAt } : null,
    })),
    usedCount: dto.usedCount, remainingCount: dto.remainingCount, createdAtISO: dto.createdAt,
  };
}

// Demo: a purchase keeps its item snapshot; which items are used comes from the bookings.
type MockPurchase = Omit<PackagePurchase, "items" | "usedCount" | "remainingCount"> & {
  items: Omit<PackagePurchaseItem, "booking">[];
};
type MockSeed = Pick<PackagePurchase, "id" | "version" | "clientId" | "packageId" | "notes" | "paymentStatus"
  | "paymentReceivedAtISO" | "status" | "createdAtISO">;
let mock: MockPurchase[] | null = null;
const LIVE = ["pending", "confirmed", "completed", "noshow"] as const;

async function snapshot(packageId: string) {
  const item = await getPackage(packageId);
  if (!item) throw new NotFoundError("package", packageId);
  const names = new Map((await listServices()).map((service) => [service.id, service.name]));
  const items = [...item.items].sort((a, b) => a.order - b.order)
    .map((entry, position) => ({ position, serviceId: entry.serviceId, title: entry.title ?? names.get(entry.serviceId) ?? "" }));
  return { item, items };
}

async function store(): Promise<MockPurchase[]> {
  if (mock) return mock;
  const seeds = mockData<MockSeed[]>("package-purchases");
  const loaded = await Promise.all(seeds.map(async (seed) => {
    const { item, items } = await snapshot(seed.packageId);
    return { ...seed, packageName: item.name, priceCents: item.priceCents, currency: item.currency, items };
  }));
  mock ??= loaded;
  return mock;
}

async function withUse(purchases: MockPurchase[]): Promise<PackagePurchase[]> {
  const [bookings, sessions] = await Promise.all([listBookings(), listSessions()]);
  const starts = new Map(sessions.map((session) => [session.id, session.startISO]));
  return purchases.map((purchase) => {
    const items = purchase.items.map((item) => {
      const holder = bookings.find((booking) => booking.packagePurchaseId === purchase.id
        && booking.packagePosition === item.position && (LIVE as readonly string[]).includes(booking.status));
      return { ...item, booking: holder ? { id: holder.id, status: holder.status as (typeof LIVE)[number],
        startISO: starts.get(holder.sessionId) ?? holder.createdAtISO } : null };
    });
    const used = items.filter((item) => item.booking).length;
    return { ...purchase, items, usedCount: used, remainingCount: purchase.status === "voided" ? 0 : items.length - used };
  });
}

export async function listClientPackagePurchases(clientId: string): Promise<PackagePurchase[]> {
  if (dataSource === "api") {
    const page = await apiRequest<components["schemas"]["PackagePurchaseList"]>(
      `/clients/${encodeURIComponent(clientId)}/package-purchases`);
    return page.items.map(mapPurchase);
  }
  await sleep(50);
  const mine = (await store()).filter((item) => item.clientId === clientId)
    .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
  return withUse(mine);
}

const mockSales = new Map<string, { fingerprint: string; id: string }>();

export async function recordPackageSale(clientId: string, input: PackageSaleInput, idempotencyKey: string): Promise<PackagePurchase> {
  if (dataSource === "api") return mapPurchase(await apiRequest<PurchaseDto, components["schemas"]["PackagePurchaseCreate"]>(
    `/clients/${encodeURIComponent(clientId)}/package-purchases`, {
      method: "POST", csrf: true, idempotencyKey,
      body: { packageId: input.packageId, paymentReceived: input.paymentReceived, notes: input.notes?.trim() || null },
    }));
  await sleep(80);
  const purchases = await store();
  const fingerprint = JSON.stringify([clientId, input.packageId, input.notes?.trim() || null]);
  const replay = mockSales.get(idempotencyKey);
  if (replay) {
    if (replay.fingerprint !== fingerprint) throw new ApiRequestError(409, "idempotency_key_reused", "That sale was already recorded differently.");
    return (await withUse(purchases.filter((item) => item.id === replay.id)))[0];
  }
  const { item, items } = await snapshot(input.packageId);
  if (item.status !== "active" || !items.length) throw new ApiRequestError(409, "package_not_for_sale", "Only an active package with sessions can be sold.");
  const now = new Date().toISOString();
  const created: MockPurchase = {
    id: makeId("pur"), version: 1, clientId, packageId: item.id, packageName: item.name, priceCents: item.priceCents,
    currency: item.currency, paymentStatus: input.paymentReceived ? "paid" : "pending",
    paymentReceivedAtISO: input.paymentReceived ? now : undefined, status: "active",
    notes: input.notes?.trim() || undefined, items, createdAtISO: now,
  };
  mock = [created, ...purchases];
  mockSales.set(idempotencyKey, { fingerprint, id: created.id });
  return (await withUse([created]))[0];
}

async function change(id: string, expectedVersion: number, apply: (item: MockPurchase) => boolean, path: string): Promise<PackagePurchase> {
  if (dataSource === "api") return mapPurchase(await apiRequest<PurchaseDto>(
    `/package-purchases/${encodeURIComponent(id)}/${path}`, { method: "POST", csrf: true, expectedVersion }));
  await sleep(60);
  const item = (await store()).find((entry) => entry.id === id);
  if (!item) throw new NotFoundError("package purchase", id);
  const version = nextEditVersion(item, expectedVersion);
  if (!apply(item)) throw new ApiRequestError(409, "package_purchase_transition_invalid", "This package sale can't make that change.");
  item.version = version;
  return (await withUse([item]))[0];
}

export function markPackagePaid(id: string, expectedVersion: number): Promise<PackagePurchase> {
  return change(id, expectedVersion, (item) => {
    if (item.paymentStatus !== "pending") return false;
    item.paymentStatus = "paid"; item.paymentReceivedAtISO = new Date().toISOString();
    return true;
  }, "payment-received");
}

export function voidPackagePurchase(id: string, expectedVersion: number): Promise<PackagePurchase> {
  return change(id, expectedVersion, (item) => {
    if (item.status !== "active") return false;
    item.status = "voided"; item.voidedAtISO = new Date().toISOString();
    return true;
  }, "void");
}

/** Demo only: the lowest unused position of `serviceId` in the client's purchase. */
export async function claimMockPackageItem(purchaseId: string, clientId: string, serviceId: string): Promise<number> {
  const [purchase] = await withUse((await store()).filter((item) => item.id === purchaseId && item.clientId === clientId));
  if (!purchase) throw new ApiRequestError(409, "package_credit_unavailable", "This client's package has no session left for this service.");
  if (purchase.status === "voided") throw new ApiRequestError(409, "package_voided", "This package was voided, so its sessions can't be booked.");
  const free = purchase.items.find((item) => item.serviceId === serviceId && !item.booking);
  if (!free) throw new ApiRequestError(409, "package_credit_unavailable", "This client's package has no session left for this service.");
  return free.position;
}

/** Active purchases with an unused session for `serviceId`, for the New booking drawer. */
export async function packagesCovering(clientId: string, serviceId: string): Promise<PackagePurchase[]> {
  return (await listClientPackagePurchases(clientId)).filter((purchase) => purchase.status === "active"
    && purchase.items.some((item) => item.serviceId === serviceId && !item.booking));
}

/** Demo only: a sold package can't be deleted, as in the API. */
export async function isPackageSold(packageId: string): Promise<boolean> {
  return (await store()).some((item) => item.packageId === packageId);
}
