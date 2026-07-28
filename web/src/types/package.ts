/**
 * Packages are lightweight Phase 1 demo entities: multi-session offers an
 * operator (consultant / coach / instructor) sells or presents to their own
 * clients. Examples: a 4-session coaching package, a strategy sprint package.
 *
 * A package is an ordered bundle of existing services. Each `PackageItem` points
 * to a `Service` by id; multiple items may reference the same service, and the
 * operator arranges them in a custom order. The source of truth for the
 * service↔package relationship is `ServicePackage.items[].serviceId` — there is
 * NO `Service.packageIds` field.
 *
 * This is a product/demo model only. It deliberately does NOT implement real
 * checkout, credit/balance ledgers, session consumption, entitlements,
 * recurring billing, memberships, coupons, gift cards, or Stripe product/price
 * objects.
 *
 * Do NOT confuse this with platform billing: Settings → Billing & Subscription
 * is how the *operator* pays Slotera; packages are what the operator sells to
 * *their own clients*. See CLAUDE.md → "Packages".
 */
import type { Currency } from "@/types/common";

export type ServicePackageStatus = "active" | "inactive";

export type PackageItem = {
  id: string;
  /** Points to an existing Service. Multiple items may share a serviceId. */
  serviceId: string;
  /** Optional label shown instead of the service name (e.g. "Kick-off call"). */
  title?: string;
  /** Optional one-line note for this step of the package. */
  description?: string;
  /** Position within the package (ascending). */
  order: number;
};

export type ServicePackage = {
  id: string;
  name: string;
  description: string;
  status: ServicePackageStatus;
  priceCents: number;
  currency: Currency;
  /** Ordered services that make up the package. Source of truth for the relationship. */
  items: PackageItem[];
  /** Operator-only notes. Never shown to clients. */
  notes?: string;
  /** Highlighted in admin + public hint. */
  featured?: boolean;
  createdAtISO: string;
  updatedAtISO: string;
};

export type ServicePackageInput = Omit<
  ServicePackage,
  "id" | "createdAtISO" | "updatedAtISO"
>;
