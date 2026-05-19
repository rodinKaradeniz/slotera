export type PlanId = "solo" | "team" | "custom";

export type BillingCycle = "monthly" | "yearly";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancel_scheduled"
  | "cancelled";

export type BillingPaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holder: string;
};

export type SubscriptionPlan = {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: "GBP";
  maxMembers: number;
  features: string[];
  highlight?: boolean;
};

export type WorkspaceSubscription = {
  id: string;
  workspaceId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAtISO: string | null;
  nextBillingAtISO: string | null;
  cancelAtISO: string | null;
  amount: number;
  currency: "GBP";
  seats: number;
  maxSeats: number;
  usage: {
    activeServices: number;
    monthlyBookings: number;
    clients: number;
  };
  paymentMethod: BillingPaymentMethod | null;
};

export type InvoiceStatus = "paid" | "open" | "void" | "uncollectible";

export type Invoice = {
  id: string;
  workspaceId: string;
  number: string;
  amount: number;
  currency: "GBP";
  status: InvoiceStatus;
  issuedAtISO: string;
  paidAtISO: string | null;
  planId: PlanId;
  billingCycle: BillingCycle;
};
