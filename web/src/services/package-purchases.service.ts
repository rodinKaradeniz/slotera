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
import { currentPublicWorkspaceSlug } from "./public-booking.service";
import { getPaymentSettings } from "./settings.service";
import { readLang } from "@/lib/i18n";
import { saveDemoPurchase, syncDemoPurchases, type DemoPurchaseRecord } from "@/lib/demo-bookings";
import type { Client } from "@/types/client";

type PurchaseDto = components["schemas"]["PackagePurchaseView"];

function mapPurchase(dto: PurchaseDto): PackagePurchase {
  return {
    id: dto.id, version: dto.version, clientId: dto.clientId, packageId: dto.packageId,
    packageName: dto.packageName, priceCents: dto.priceCents, currency: dto.currency as Currency,
    paymentStatus: dto.paymentStatus, paymentReceivedAtISO: dto.paymentReceivedAt ?? undefined,
    status: dto.status, voidedAtISO: dto.voidedAt ?? undefined, notes: dto.notes ?? undefined,
    refundedCents: dto.refundedCents, refundedAtISO: dto.refundedAt ?? undefined,
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

// Package requests a visitor made on the demo booking page, possibly in another tab.
let demoRequests: DemoPurchaseRecord[] = [];
if (dataSource === "mock") syncDemoPurchases((records) => { demoRequests = records; });

async function fromSeed(seed: MockSeed): Promise<MockPurchase> {
  const { item, items } = await snapshot(seed.packageId);
  return { ...seed, packageName: item.name, priceCents: item.priceCents, currency: item.currency, refundedCents: 0, items };
}

async function store(): Promise<MockPurchase[]> {
  if (!mock) {
    const loaded = await Promise.all(mockData<MockSeed[]>("package-purchases").map(fromSeed));
    mock ??= loaded;
  }
  const missing = demoRequests.filter((record) => !mock!.some((item) => item.id === record.purchase.id));
  for (const record of missing) {
    const added = await fromSeed({ ...record.purchase, version: 1, paymentStatus: "pending", status: "active" });
    if (!mock.some((item) => item.id === added.id)) mock = [added, ...mock];
  }
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
      body: { packageId: input.packageId, paymentReceived: input.paymentReceived, notes: input.notes?.trim() || null,
        notifyClient: input.notifyClient ?? true },
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
    notes: input.notes?.trim() || undefined, refundedCents: 0, items, createdAtISO: now,
  };
  mock = [created, ...purchases];
  mockSales.set(idempotencyKey, { fingerprint, id: created.id });
  return (await withUse([created]))[0];
}

async function change(id: string, expectedVersion: number, apply: (item: MockPurchase) => boolean, path: string, body?: object): Promise<PackagePurchase> {
  if (dataSource === "api") return mapPurchase(await apiRequest<PurchaseDto, object>(
    `/package-purchases/${encodeURIComponent(id)}/${path}`, { method: "POST", csrf: true, expectedVersion, body }));
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

/** What can still be refunded on a sale: its price minus earlier refunds, once paid. */
export function saleRefundableCents(purchase: Pick<PackagePurchase, "paymentStatus" | "priceCents" | "refundedCents">): number {
  return purchase.paymentStatus === "paid" ? purchase.priceCents - purchase.refundedCents : 0;
}

/** Record money given back for a paid sale; a voided sale can still be refunded. */
export async function refundPackagePurchase(id: string, expectedVersion: number, amountCents: number): Promise<PackagePurchase> {
  if (dataSource !== "api") {
    const item = (await store()).find((entry) => entry.id === id);
    if (item && (amountCents <= 0 || amountCents > saleRefundableCents(item))) {
      throw new ApiRequestError(409, "package_refund_invalid", "A refund can only be recorded on a paid sale, up to its price.");
    }
  }
  return change(id, expectedVersion, (item) => {
    item.refundedCents += amountCents; item.refundedAtISO = new Date().toISOString();
    return true;
  }, "refund", { amountCents });
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

export type PackageRequest = components["schemas"]["PublicPackageRequestResponse"];
export type PackageBuyer = { firstName: string; lastName: string; email: string; phone?: string };
const mockRequests = new Map<string, { fingerprint: string; result: PackageRequest }>();

/**
 * A visitor asks to buy a package on the booking page. It waits for the manual payment the
 * consultant records; the visitor gets the payment details on screen and by email.
 */
export async function requestPackage(packageId: string, buyer: PackageBuyer, idempotencyKey: string): Promise<PackageRequest> {
  if (dataSource === "api") {
    const slug = currentPublicWorkspaceSlug();
    if (!slug) throw new NotFoundError("Booking page", "(no workspace selected)");
    return apiRequest<PackageRequest, components["schemas"]["PublicPackageRequest"]>(
      `/public/workspaces/${encodeURIComponent(slug)}/package-purchases`, {
        method: "POST", idempotencyKey,
        body: { packageId, language: readLang(), termsAccepted: true,
          customer: { firstName: buyer.firstName.trim(), lastName: buyer.lastName.trim(), email: buyer.email.trim(), phone: buyer.phone?.trim() || null } },
      });
  }
  await sleep(300);
  const fingerprint = JSON.stringify([packageId, buyer.email.trim().toLowerCase()]);
  const replay = mockRequests.get(idempotencyKey);
  if (replay) {
    if (replay.fingerprint !== fingerprint) throw new ApiRequestError(409, "idempotency_key_reused", "That request was already sent differently.");
    return replay.result;
  }
  const { item, items } = await snapshot(packageId);
  const { listClients } = await import("./clients.service");
  const email = buyer.email.trim();
  const existing = (await listClients()).find((entry) => entry.email.toLowerCase() === email.toLowerCase());
  const id = makeId("pur");
  const now = new Date().toISOString();
  const client: Client | null = existing ? null : {
    version: 1, id: `cli-demo-${id}`, name: `${buyer.firstName} ${buyer.lastName}`.trim(), email,
    phone: buyer.phone || undefined, tag: "new", joinedISO: now,
    totalBookings: 0, completedBookings: 0, cancelledBookings: 0, totalSpentCents: 0,
  };
  saveDemoPurchase({ purchase: { id, clientId: existing?.id ?? client!.id, packageId, createdAtISO: now }, client });
  const payments = await getPaymentSettings();
  const result: PackageRequest = {
    id, packageName: item.name, priceCents: item.priceCents, currency: item.currency, paymentStatus: "pending",
    sessionCount: items.length, manualPaymentInstructions: payments.manualPaymentInstructions,
  };
  mockRequests.set(idempotencyKey, { fingerprint, result });
  return result;
}
