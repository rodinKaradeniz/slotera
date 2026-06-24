/**
 * Packages & programs are lightweight Phase 1 demo entities: multi-session
 * offers an operator (consultant / coach / instructor) sells or presents to
 * their own clients. Examples: a 4-session coaching package, an 8-week strategy
 * program, a group workshop series.
 *
 * This is a product/demo model only. It deliberately does NOT implement real
 * checkout, credit/balance ledgers, session consumption, entitlements,
 * recurring billing, memberships, coupons, gift cards, or Stripe product/price
 * objects. Future iterations may add package purchase, remaining credits,
 * program enrollment, and customer package management.
 *
 * Do NOT confuse this with platform billing: Settings → Billing & Subscription
 * is how the *operator* pays Slotera; packages/programs are what the operator
 * sells to *their own clients*. See CLAUDE.md → "Packages / Programs".
 *
 * Relationship to services is single-sourced on `attachedServiceIds` (mirrors
 * `FormTemplate.attachedServiceIds`) — there is no `Service.packageProgramIds`.
 */
import type { Currency } from "@/types/common";

export type PackageProgramKind = "package" | "program";

export type PackageProgramStatus = "active" | "inactive";

export type PackageProgram = {
  id: string;
  name: string;
  description: string;
  status: PackageProgramStatus;
  /** `package` = bundle of sessions/credits; `program` = structured offer over time. */
  kind: PackageProgramKind;
  priceCents: number;
  currency: Currency;
  /** How many sessions the package/program includes (display-only — no ledger). */
  includedSessionCount?: number;
  /** Free-text duration, e.g. "8 weeks", "4 sessions". */
  durationLabel?: string;
  /** How long the package stays usable after purchase, in days (display-only). */
  validityDays?: number;
  /** Services this package/program can be used with. Source of truth for the relationship. */
  attachedServiceIds: string[];
  /** Optional intake/program forms (display-only association — not wired into checkout). */
  formTemplateIds?: string[];
  /** Operator-only notes. Never shown to clients. */
  notes?: string;
  /** Highlighted in admin + public hint. */
  featured?: boolean;
  createdAtISO: string;
  updatedAtISO: string;
};

export type PackageProgramInput = Omit<
  PackageProgram,
  "id" | "createdAtISO" | "updatedAtISO"
>;
