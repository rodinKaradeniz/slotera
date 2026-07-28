"use client";

import workspacesJson from "@/data/mock/platform-workspaces.json";
import subscriptionsJson from "@/data/mock/platform-subscriptions.json";
import inquiriesJson from "@/data/mock/platform-inquiries.json";
import overviewJson from "@/data/mock/platform-overview.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type {
  PlatformInquiry,
  PlatformInquiryType,
  PlatformOverview,
  PlatformSubscription,
  Workspace,
} from "@/types/platform";
import type { BillingCycle, PlanId, SubscriptionStatus } from "@/types/billing";
import { NotFoundError, NotImplementedError } from "./_errors";

let workspaces: Workspace[] = JSON.parse(
  JSON.stringify(workspacesJson),
) as Workspace[];
let subscriptions: PlatformSubscription[] = JSON.parse(
  JSON.stringify(subscriptionsJson),
) as PlatformSubscription[];
let inquiries: PlatformInquiry[] = JSON.parse(
  JSON.stringify(inquiriesJson),
) as PlatformInquiry[];

export async function getPlatformOverview(): Promise<PlatformOverview> {
  if (dataSource !== "mock") throw new NotImplementedError("getPlatformOverview");
  await sleep(80);
  return overviewJson as unknown as PlatformOverview;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listWorkspaces");
  await sleep(80);
  return [...workspaces];
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getWorkspace");
  await sleep(60);
  return workspaces.find((w) => w.id === id) ?? null;
}

/**
 * Slotera staff manually provisions a workspace (typically after a Custom-plan
 * inquiry). Creates the workspace AND the matching `PlatformSubscription` so
 * the new row shows up consistently across Workspaces, Subscriptions, and the
 * Overview KPIs.
 */
export type CreateWorkspaceInput = {
  name: string;
  ownerName: string;
  ownerEmail: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  seats: number;
  /** Pounds, not cents. Converted internally. */
  amountPounds: number;
  trialEndsAtISO?: string | null;
  nextBillingAtISO?: string | null;
};

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  if (dataSource !== "mock") throw new NotImplementedError("createWorkspace");
  await sleep(180);

  const id = `ws-${Math.random().toString(36).slice(2, 8)}`;
  const nowISO = new Date().toISOString();
  const slug = slugifyWorkspace(input.name);

  const workspace: Workspace = {
    id,
    name: input.name.trim(),
    slug,
    ownerName: input.ownerName.trim(),
    ownerEmail: input.ownerEmail.trim().toLowerCase(),
    planId: input.planId,
    subscriptionStatus: input.status,
    createdAtISO: nowISO,
    lastActiveISO: nowISO,
    bookingsCount: 0,
    servicesCount: 0,
    clientsCount: 0,
  };

  const subscription: PlatformSubscription = {
    id: `sub-${id}`,
    workspaceId: id,
    workspaceName: workspace.name,
    planId: input.planId,
    status: input.status,
    billingCycle: input.billingCycle,
    trialEndsAtISO: input.trialEndsAtISO ?? null,
    nextBillingAtISO: input.nextBillingAtISO ?? null,
    amount: Math.round(input.amountPounds * 100),
    currency: "GBP",
    paymentStatus: input.status === "trialing" ? "n/a" : "paid",
  };

  workspaces = [workspace, ...workspaces];
  subscriptions = [subscription, ...subscriptions];
  return workspace;
}

function slugifyWorkspace(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || `workspace-${Math.random().toString(36).slice(2, 6)}`;
}

export async function setWorkspacePlan(
  id: string,
  planId: PlanId,
): Promise<Workspace> {
  if (dataSource !== "mock") throw new NotImplementedError("setWorkspacePlan");
  await sleep(120);
  const idx = workspaces.findIndex((w) => w.id === id);
  if (idx === -1) throw new NotFoundError("workspace", id);
  const next: Workspace = { ...workspaces[idx], planId };
  workspaces = [...workspaces.slice(0, idx), next, ...workspaces.slice(idx + 1)];
  const subIdx = subscriptions.findIndex((s) => s.workspaceId === id);
  if (subIdx !== -1) {
    subscriptions = [
      ...subscriptions.slice(0, subIdx),
      { ...subscriptions[subIdx], planId },
      ...subscriptions.slice(subIdx + 1),
    ];
  }
  return next;
}

export async function suspendWorkspace(
  id: string,
  suspended: boolean,
): Promise<Workspace> {
  if (dataSource !== "mock") throw new NotImplementedError("suspendWorkspace");
  await sleep(100);
  const idx = workspaces.findIndex((w) => w.id === id);
  if (idx === -1) throw new NotFoundError("workspace", id);
  const next: Workspace = { ...workspaces[idx], suspended };
  workspaces = [...workspaces.slice(0, idx), next, ...workspaces.slice(idx + 1)];
  return next;
}

export async function listPlatformSubscriptions(): Promise<PlatformSubscription[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listPlatformSubscriptions");
  await sleep(80);
  return [...subscriptions];
}

export async function setSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
): Promise<PlatformSubscription> {
  if (dataSource !== "mock") throw new NotImplementedError("setSubscriptionStatus");
  await sleep(100);
  const idx = subscriptions.findIndex((s) => s.id === id);
  if (idx === -1) throw new NotFoundError("subscription", id);
  const next: PlatformSubscription = { ...subscriptions[idx], status };
  subscriptions = [
    ...subscriptions.slice(0, idx),
    next,
    ...subscriptions.slice(idx + 1),
  ];
  return next;
}

export async function setSubscriptionPlan(
  id: string,
  planId: PlanId,
): Promise<PlatformSubscription> {
  if (dataSource !== "mock") throw new NotImplementedError("setSubscriptionPlan");
  await sleep(100);
  const idx = subscriptions.findIndex((s) => s.id === id);
  if (idx === -1) throw new NotFoundError("subscription", id);
  const next: PlatformSubscription = { ...subscriptions[idx], planId };
  subscriptions = [
    ...subscriptions.slice(0, idx),
    next,
    ...subscriptions.slice(idx + 1),
  ];
  return next;
}

export async function listInquiries(): Promise<PlatformInquiry[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listInquiries");
  await sleep(80);
  return [...inquiries];
}

/**
 * Persists a new platform inquiry. Used by the Custom-plan registration path
 * (and any future "talk to sales" CTAs) so Slotera staff see the lead in the
 * superadmin Inquiries view. Distinct from the general public `ContactModal`,
 * which by default does NOT persist.
 */
export async function createInquiry(input: {
  name: string;
  email: string;
  type: PlatformInquiryType;
  message: string;
}): Promise<PlatformInquiry> {
  if (dataSource !== "mock") throw new NotImplementedError("createInquiry");
  await sleep(160);
  const created: PlatformInquiry = {
    id: `inq-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    type: input.type,
    message: input.message.trim(),
    read: false,
    createdAtISO: new Date().toISOString(),
  };
  inquiries = [created, ...inquiries];
  return created;
}

/**
 * Toggle read/unread on a single inquiry. Used by the preview modal (auto-marks
 * read on open) and by the "Mark unread" footer action.
 */
export async function setInquiryRead(
  id: string,
  read: boolean,
): Promise<PlatformInquiry> {
  if (dataSource !== "mock") throw new NotImplementedError("setInquiryRead");
  await sleep(60);
  const idx = inquiries.findIndex((i) => i.id === id);
  if (idx === -1) throw new NotFoundError("inquiry", id);
  const next: PlatformInquiry = { ...inquiries[idx], read };
  inquiries = [...inquiries.slice(0, idx), next, ...inquiries.slice(idx + 1)];
  return next;
}
