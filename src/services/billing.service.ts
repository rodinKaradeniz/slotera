"use client";

import plansJson from "@/data/mock/plans.json";
import subscriptionJson from "@/data/mock/subscription.json";
import invoicesJson from "@/data/mock/invoices.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type {
  BillingCycle,
  BillingPaymentMethod,
  Invoice,
  PlanId,
  SubscriptionPlan,
  SubscriptionStatus,
  WorkspaceSubscription,
} from "@/types/billing";
import { NotImplementedError } from "./_errors";

let subscription: WorkspaceSubscription = JSON.parse(
  JSON.stringify(subscriptionJson),
) as WorkspaceSubscription;
const invoices: Invoice[] = JSON.parse(JSON.stringify(invoicesJson)) as Invoice[];

export async function listPlans(): Promise<SubscriptionPlan[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listPlans");
  await sleep(40);
  return plansJson as unknown as SubscriptionPlan[];
}

export async function getPlan(id: PlanId): Promise<SubscriptionPlan | null> {
  const plans = await listPlans();
  return plans.find((p) => p.id === id) ?? null;
}

export async function getSubscription(): Promise<WorkspaceSubscription> {
  if (dataSource !== "mock") throw new NotImplementedError("getSubscription");
  await sleep(80);
  return { ...subscription };
}

export async function changePlan(
  planId: PlanId,
  billingCycle: BillingCycle = subscription.billingCycle,
): Promise<WorkspaceSubscription> {
  if (dataSource !== "mock") throw new NotImplementedError("changePlan");
  await sleep(160);
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);
  const amount = plan
    ? (billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly)
    : subscription.amount;
  subscription = {
    ...subscription,
    planId,
    billingCycle,
    amount,
    maxSeats: plan?.maxMembers ?? subscription.maxSeats,
    status:
      subscription.status === "cancelled" || subscription.status === "cancel_scheduled"
        ? "active"
        : subscription.status,
    cancelAtISO: null,
  };
  return { ...subscription };
}

export async function cancelSubscription(): Promise<WorkspaceSubscription> {
  if (dataSource !== "mock") throw new NotImplementedError("cancelSubscription");
  await sleep(120);
  subscription = {
    ...subscription,
    status: "cancel_scheduled",
    cancelAtISO: subscription.nextBillingAtISO,
  };
  return { ...subscription };
}

export async function reactivateSubscription(): Promise<WorkspaceSubscription> {
  if (dataSource !== "mock")
    throw new NotImplementedError("reactivateSubscription");
  await sleep(120);
  subscription = {
    ...subscription,
    status: "active",
    cancelAtISO: null,
  };
  return { ...subscription };
}

export async function setSubscriptionStatus(
  status: SubscriptionStatus,
): Promise<WorkspaceSubscription> {
  if (dataSource !== "mock") throw new NotImplementedError("setSubscriptionStatus");
  await sleep(80);
  subscription = { ...subscription, status };
  return { ...subscription };
}

export async function listInvoices(): Promise<Invoice[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listInvoices");
  await sleep(60);
  return [...invoices];
}

export async function updateMockPaymentMethod(
  input: BillingPaymentMethod,
): Promise<WorkspaceSubscription> {
  if (dataSource !== "mock")
    throw new NotImplementedError("updateMockPaymentMethod");
  await sleep(120);
  subscription = { ...subscription, paymentMethod: { ...input } };
  return { ...subscription };
}
