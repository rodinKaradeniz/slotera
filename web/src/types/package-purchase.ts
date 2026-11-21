import type { Currency } from "@/types/common";

/**
 * A package the operator sold to a client. The client paid outside Slotera, so this is a
 * record, not a checkout. Each item is one session of the package; a live booking holds
 * an item, and cancelling that booking gives it back. Distinct from platform billing.
 */
export type PackagePurchaseItem = {
  /** Zero-based, in the package's order. */
  position: number;
  serviceId: string;
  title: string;
  booking: { id: string; status: "pending" | "confirmed" | "completed" | "noshow"; startISO: string } | null;
};

export type PackagePurchase = {
  id: string;
  version: number;
  clientId: string;
  packageId: string;
  packageName: string;
  priceCents: number;
  currency: Currency;
  paymentStatus: "pending" | "paid";
  paymentReceivedAtISO?: string;
  status: "active" | "voided";
  voidedAtISO?: string;
  notes?: string;
  items: PackagePurchaseItem[];
  usedCount: number;
  remainingCount: number;
  createdAtISO: string;
};

export type PackageSaleInput = { packageId: string; paymentReceived: boolean; notes?: string };
