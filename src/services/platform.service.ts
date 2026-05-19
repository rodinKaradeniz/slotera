"use client";

import workspacesJson from "@/data/mock/platform-workspaces.json";
import subscriptionsJson from "@/data/mock/platform-subscriptions.json";
import inquiriesJson from "@/data/mock/platform-inquiries.json";
import overviewJson from "@/data/mock/platform-overview.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type {
  PlatformInquiry,
  PlatformInquiryStatus,
  PlatformOverview,
  PlatformSubscription,
  Workspace,
} from "@/types/platform";
import type { PlanId, SubscriptionStatus } from "@/types/billing";
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

export async function setInquiryStatus(
  id: string,
  status: PlatformInquiryStatus,
): Promise<PlatformInquiry> {
  if (dataSource !== "mock") throw new NotImplementedError("setInquiryStatus");
  await sleep(80);
  const idx = inquiries.findIndex((i) => i.id === id);
  if (idx === -1) throw new NotFoundError("inquiry", id);
  const next: PlatformInquiry = { ...inquiries[idx], status };
  inquiries = [...inquiries.slice(0, idx), next, ...inquiries.slice(idx + 1)];
  return next;
}
