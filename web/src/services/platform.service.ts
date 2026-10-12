"use client";

// The superadmin area exists only in the real app (its layout 404s in the mock demo),
// so its functions have no mock branch. `createInquiry` keeps one: the demo's contact
// form uses it.

import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type {
  PlatformInquiry,
  PlatformInquiryType,
  PlatformOverview,
  PlatformWorkspace,
} from "@/types/platform";
import { NotFoundError, NotImplementedError } from "./_errors";

type PlatformWorkspaceSummaryDto =
  components["schemas"]["PlatformWorkspaceSummary"];
type PlatformWorkspaceDetailDto =
  components["schemas"]["PlatformWorkspaceDetail"];
type PlatformWorkspaceListDto =
  components["schemas"]["PlatformWorkspaceListResponse"];
type PlatformWorkspaceProvisionDto =
  components["schemas"]["PlatformWorkspaceProvision"];
type PlatformInquiryDto = components["schemas"]["PlatformInquiryResponse"];
type PlatformOverviewDto = components["schemas"]["PlatformOverviewResponse"];
type PlatformInquiryListDto = components["schemas"]["PlatformInquiryListResponse"];
type PublicInquiryCreateDto = components["schemas"]["PublicInquiryCreate"];

function requireApi(name: string): void {
  if (dataSource !== "api") throw new NotImplementedError(name);
}

export function mapPlatformOverview(overview: PlatformOverviewDto): PlatformOverview {
  return {
    workspacesTotal: overview.workspacesTotal,
    workspacesActive: overview.workspacesActive,
    workspacesSuspended: overview.workspacesSuspended,
    workspacesEssentials: overview.workspacesEssentials,
    workspacesProfessional: overview.workspacesProfessional,
    workspacesOnTrial: overview.workspacesOnTrial,
    signups30d: overview.signups30D,
    bookings30d: overview.bookings30D,
    inquiriesUnread: overview.inquiriesUnread,
    emailsPending: overview.emailsPending,
    emailsFailing: overview.emailsFailing,
    emailLastError: overview.emailLastError,
  };
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  requireApi("getPlatformOverview");
  return mapPlatformOverview(await apiRequest<PlatformOverviewDto>("/platform/overview"));
}

export function mapPlatformWorkspace(
  workspace: PlatformWorkspaceSummaryDto | PlatformWorkspaceDetailDto,
): PlatformWorkspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    ownerName: workspace.ownerName,
    ownerEmail: workspace.ownerEmail,
    createdAtISO: workspace.createdAt,
    operationalStatus: workspace.operationalStatus,
    plan: workspace.plan,
    billingInterval: workspace.billingInterval,
    trialEndsAtISO: workspace.trialEndsAt,
    paidThrough: workspace.paidThrough ?? null,
    closureRequestedAtISO: workspace.closureRequestedAt,
    servicesCount: workspace.servicesCount,
    clientsCount: workspace.clientsCount,
    bookingsCount: workspace.bookingsCount,
    sessionsCount: workspace.sessionsCount,
    ...( "currency" in workspace
      ? { currency: workspace.currency, timezone: workspace.timezone }
      : {}),
  };
}

export async function listWorkspaces(): Promise<PlatformWorkspace[]> {
  requireApi("listWorkspaces");
  const response = await apiRequest<PlatformWorkspaceListDto>("/platform/workspaces?limit=100");
  return response.items.map(mapPlatformWorkspace);
}

export async function getWorkspace(id: string): Promise<PlatformWorkspace | null> {
  requireApi("getWorkspace");
  try {
    return mapPlatformWorkspace(
      await apiRequest<PlatformWorkspaceDetailDto>(`/platform/workspaces/${id}`),
    );
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  }
}

export type ProvisionWorkspaceInput = PlatformWorkspaceProvisionDto;

export async function provisionWorkspace(
  input: ProvisionWorkspaceInput,
): Promise<PlatformWorkspace> {
  requireApi("provisionWorkspace");
  const response = await apiRequest<PlatformWorkspaceDetailDto, PlatformWorkspaceProvisionDto>(
    "/platform/workspaces",
    { method: "POST", body: input, csrf: true },
  );
  return mapPlatformWorkspace(response);
}

export type WorkspaceBillingChange = components["schemas"]["PlatformBillingChange"];

/** Plans are invoiced manually until Stripe Billing exists; staff record them here. */
export async function setPlatformWorkspaceBilling(
  id: string,
  change: WorkspaceBillingChange,
): Promise<PlatformWorkspace> {
  requireApi("setPlatformWorkspaceBilling");
  const response = await apiRequest<PlatformWorkspaceDetailDto, WorkspaceBillingChange>(
    `/platform/workspaces/${id}/billing`,
    { method: "POST", body: change, csrf: true },
  );
  return mapPlatformWorkspace(response);
}

export async function suspendWorkspace(
  id: string,
  suspended: boolean,
): Promise<PlatformWorkspace> {
  requireApi("suspendWorkspace");
  const action = suspended ? "suspend" : "reactivate";
  const response = await apiRequest<PlatformWorkspaceDetailDto>(
    `/platform/workspaces/${id}/${action}`,
    { method: "POST", csrf: true },
  );
  return mapPlatformWorkspace(response);
}

export function mapInquiry(item: PlatformInquiryDto): PlatformInquiry {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    company: item.company,
    type: item.reason as PlatformInquiryType,
    message: item.message,
    read: item.readAt !== null,
    createdAtISO: item.createdAt,
  };
}

export async function listInquiries(): Promise<PlatformInquiry[]> {
  requireApi("listInquiries");
  const response = await apiRequest<PlatformInquiryListDto>("/platform/inquiries");
  return response.items.map(mapInquiry);
}

/**
 * Saves a contact-form message for Slotera staff (superadmin Inquiries). The demo
 * pretends to send it and stores nothing.
 */
export async function createInquiry(input: {
  name: string;
  email: string;
  type: PlatformInquiryType;
  message: string;
}): Promise<PlatformInquiry> {
  const created: PlatformInquiry = {
    id: "",
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: null,
    type: input.type,
    message: input.message.trim(),
    read: false,
    createdAtISO: new Date().toISOString(),
  };
  if (dataSource === "api") {
    await apiRequest<unknown, PublicInquiryCreateDto>("/public/inquiries", {
      method: "POST",
      body: {
        name: created.name,
        email: input.email.trim(),
        reason: input.type,
        message: created.message,
      },
    });
    // The public endpoint deliberately returns no record; echo what was sent.
    return created;
  }
  await sleep(160);
  return created;
}

/**
 * Toggle read/unread on a single inquiry. Used by the preview modal (auto-marks
 * read on open) and by the "Mark unread" footer action.
 */
export async function setInquiryRead(id: string, read: boolean): Promise<PlatformInquiry> {
  requireApi("setInquiryRead");
  await apiRequest<void, { read: boolean }>(
    `/platform/inquiries/${encodeURIComponent(id)}/read`,
    { method: "POST", body: { read }, csrf: true },
  );
  const updated = (await listInquiries()).find((item) => item.id === id);
  if (!updated) throw new NotFoundError("inquiry", id);
  return updated;
}

export type PilotApplication = components["schemas"]["PublicPilotApplication"];

/** The pilot waitlist form (real app only; the demo links to it). */
export async function submitPilotApplication(input: PilotApplication): Promise<void> {
  requireApi("submitPilotApplication");
  await apiRequest<unknown, PilotApplication>("/public/pilot-applications", {
    method: "POST",
    body: input,
  });
}
