import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { getService, updateService } from "./services.service";
import { getBooking } from "./bookings.service";
import { ApiRequestError } from "./_errors";
export type FollowupRule = components["schemas"]["FollowupRuleView"];
export type FollowupRuleInput = components["schemas"]["FollowupRuleInput"];
export type Followup = components["schemas"]["FollowupView"];
const rules = new Map<string, FollowupRuleInput>();
const followups = new Map<string, Followup>();
const commands = new Map<string, { body: string; result: Followup }>();
export async function getFollowupRule(
  id: string,
  signal?: AbortSignal,
): Promise<FollowupRule> {
  if (dataSource === "api")
    return apiRequest<FollowupRule>(
      `/services/${encodeURIComponent(id)}/follow-up`,
      { signal },
    );
  const service = await getService(id);
  if (!service) throw new Error("Service missing");
  return {
    ...(rules.get(id) ?? {
      enabled: false,
      delayHours: 24,
      message: "",
      formTemplateId: null,
    }),
    version: service.version ?? 1,
  };
}
export async function saveFollowupRule(
  id: string,
  body: FollowupRuleInput,
  version: number,
): Promise<FollowupRule> {
  if (dataSource === "api")
    return apiRequest<FollowupRule, FollowupRuleInput>(
      `/services/${encodeURIComponent(id)}/follow-up`,
      { method: "PATCH", csrf: true, expectedVersion: version, body },
    );
  const service = await updateService(id, {}, version);
  rules.set(id, body);
  return { ...body, version: service.version ?? 1 };
}
export async function getBookingFollowup(
  id: string,
  signal?: AbortSignal,
): Promise<Followup> {
  if (dataSource === "api")
    return apiRequest<Followup>(
      `/bookings/${encodeURIComponent(id)}/follow-up`,
      { signal },
    );
  const booking = await getBooking(id);
  if (!booking) throw new Error("Booking missing");
  return (
    followups.get(id) ?? {
      version: 0,
      state: "none",
      recipientEmail: booking.emailContact ?? "",
      message: "",
      dueAt: null,
      queuedAt: null,
      canSend: booking.status === "completed",
    }
  );
}
export async function commandFollowup(
  id: string,
  action: "send" | "skip",
  reviewed: Followup,
  key: string,
): Promise<Followup> {
  const body = {
    expectedVersion: reviewed.version,
    recipientEmail: reviewed.recipientEmail,
  };
  if (dataSource === "api")
    return apiRequest<Followup, typeof body>(
      `/bookings/${encodeURIComponent(id)}/follow-up/${action}`,
      { method: "POST", csrf: true, idempotencyKey: key, body },
    );
  const fingerprint = JSON.stringify({ id, action, body });
  const replay = commands.get(key);
  if (replay) {
    if (replay.body !== fingerprint)
      throw new ApiRequestError(
        409,
        "idempotency_key_reused",
        "Submission changed",
      );
    return replay.result;
  }
  const current = await getBookingFollowup(id);
  if (current.version !== reviewed.version || !current.canSend)
    throw new ApiRequestError(
      409,
      "resource_stale",
      "Review the latest follow-up",
    );
  const result: Followup = {
    ...current,
    version: current.version + 1,
    state: action === "send" ? "queued" : "skipped",
    queuedAt: action === "send" ? new Date().toISOString() : null,
    canSend: false,
  };
  followups.set(id, result);
  commands.set(key, { body: fingerprint, result });
  return result;
}
