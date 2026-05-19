import type {
  BillingCycle,
  PlanId,
  SubscriptionStatus,
} from "./billing";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  createdAtISO: string;
  lastActiveISO: string;
  bookingsCount: number;
  servicesCount: number;
  clientsCount: number;
  suspended?: boolean;
};

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

export type PlatformInquiryStatus = "new" | "in_review" | "resolved";

export type PlatformInquiry = {
  id: string;
  name: string;
  email: string;
  type: PlatformInquiryType;
  message: string;
  status: PlatformInquiryStatus;
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
