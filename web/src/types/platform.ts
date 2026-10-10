import type { BillingInterval, PlanId } from "@/lib/plans";

export type PlatformWorkspaceOperationalStatus = "active" | "suspended";

/** Display-safe, persisted facts exposed to a platform superadmin. */
export type PlatformWorkspace = {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAtISO: string;
  operationalStatus: PlatformWorkspaceOperationalStatus;
  /** The Slotera plan and the facts staff record while invoicing by hand. */
  plan: PlanId;
  billingInterval: BillingInterval;
  trialEndsAtISO: string;
  /** YYYY-MM-DD, or null when nothing has been invoiced yet. */
  paidThrough: string | null;
  bookingsCount: number;
  servicesCount: number;
  clientsCount: number;
  sessionsCount: number;
  currency?: string;
  timezone?: string;
};

export type PlatformInquiryType =
  | "business"
  | "pilot"
  | "development"
  | "feature"
  | "general";

export type PlatformInquiry = {
  id: string;
  name: string;
  email: string;
  /** The business name, when the sender gave one. */
  company: string | null;
  type: PlatformInquiryType;
  message: string;
  /**
   * Inbox-style read/unread state. Set to true when the operator opens the
   * preview modal; can be flipped back to false from the modal footer for
   * follow-up flagging. Replaces the older `new | in_review | resolved` enum.
   */
  read: boolean;
  createdAtISO: string;
};

/** Platform-wide counts for the superadmin home (`GET /platform/overview`). */
export type PlatformOverview = {
  workspacesTotal: number;
  workspacesActive: number;
  workspacesSuspended: number;
  workspacesEssentials: number;
  workspacesProfessional: number;
  workspacesOnTrial: number;
  signups30d: number;
  bookings30d: number;
  inquiriesUnread: number;
};
