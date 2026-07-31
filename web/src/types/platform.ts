import type {
  BillingCycle,
  PlanId,
  SubscriptionStatus,
} from "./billing";

/** Display-safe, persisted facts exposed to a platform superadmin. */
export type PlatformWorkspace = {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAtISO: string;
  bookingsCount: number;
  servicesCount: number;
  clientsCount: number;
  sessionsCount: number;
  currency?: string;
  timezone?: string;
};

/** Mock-only platform controls that do not yet exist in the local API. */
export type Workspace = PlatformWorkspace & {
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  lastActiveISO: string;
  suspended?: boolean;
};

export function isMockWorkspace(
  workspace: PlatformWorkspace,
): workspace is Workspace {
  return "planId" in workspace;
}

export type PlatformSubscription = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAtISO: string | null;
  nextBillingAtISO: string | null;
  amount: number;
  currency: "GBP";
  paymentStatus: "paid" | "pending" | "past_due" | "refunded" | "n/a";
};

export type PlatformInquiryType =
  | "business"
  | "development"
  | "feature"
  | "general";

export type PlatformInquiry = {
  id: string;
  name: string;
  email: string;
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

export type PlatformOverview = {
  totals: {
    workspaces: number;
    activeSubscriptions: number;
    trialingAccounts: number;
    mrr: number;
    pastDue: number;
    newSignupsThisWeek: number;
    openInquiries: number;
  };
  recentWorkspaces: Array<{
    id: string;
    name: string;
    ownerName: string;
    planId: PlanId;
    createdAtISO: string;
  }>;
  recentEvents: Array<{
    id: string;
    type: "subscription_created" | "subscription_cancelled" | "payment_failed" | "trial_ended" | "plan_changed";
    workspaceName: string;
    description: string;
    atISO: string;
  }>;
};
