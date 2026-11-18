import { mockData } from "@/services/adapters/mock-data";

import { apiListAll, apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import { syncDemoBookings } from "@/lib/demo-bookings";
import { verifiedMetadata } from "@/api/query-cache";
import { isoWeekdayInTimezone, sessionOverlaps } from "@/lib/calendar";
import type { SessionItem, SessionInput } from "@/types/session";
import { ApiRequestError, NotFoundError } from "./_errors";

type AddressDto = components["schemas"]["Address"];
type SessionDto = components["schemas"]["SchedulingSessionResponse"];
type SessionListDto = components["schemas"]["SessionListResponse"];
type SessionCreateDto = components["schemas"]["SessionCreate"];
type SessionPatchDto = components["schemas"]["SessionPatch"];

export type SessionUpdateScope = "this" | "this_and_following";

let mock: SessionItem[] = dataSource === "mock" ? mockData("sessions") : [] as SessionItem[];
mock = mock.map((item) => ({...item, version: item.version ?? 1}));
// Demo bookings add their own session (open services) or take a seat in an existing one.
const demoSeen = new Set<string>();
if (dataSource === "mock") syncDemoBookings((records) => {
  for (const { booking, session } of records.filter((record) => !demoSeen.has(record.booking.id)).reverse()) {
    demoSeen.add(booking.id);
    if (session) {
      if (!mock.some((item) => item.id === session.id)) mock = [...mock, session];
    } else {
      mock = mock.map((item) => item.id === booking.sessionId ? {...item, bookedCount: item.bookedCount + 1} : item);
    }
  }
});

function mapAddress(address: AddressDto) {
  return {
    street: address.street,
    street2: address.street2 ?? undefined,
    city: address.city,
    region: address.region ?? undefined,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes ?? undefined,
  };
}

function toAddressDto(address: NonNullable<SessionItem["address"]>): AddressDto {
  return {
    street: address.street,
    street2: address.street2 || null,
    city: address.city,
    region: address.region || null,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes || null,
  };
}

function mapSession(session: SessionDto): SessionItem {
  return {
    version: session.version,
    seriesVersion: session.seriesVersion ?? undefined,
    seriesId: session.seriesId ?? undefined,
    id: session.id,
    serviceId: session.serviceId,
    startISO: session.startAt,
    endISO: session.endAt,
    capacity: session.capacity,
    bookedCount: session.bookedCount,
    status: session.status,
    locationType: session.locationType,
    location: session.location,
    address: session.address ? mapAddress(session.address) : undefined,
    recurring: session.recurring,
    notes: session.notes ?? undefined,
  };
}


function createPayload(input: SessionInput): SessionCreateDto {
  if (input.recurring === "custom") {
    throw new ApiRequestError(
      400,
      "custom_recurrence_not_configured",
      "Custom recurrence is not available in the local API calendar yet.",
    );
  }
  return {
    serviceId: input.serviceId,
    startAt: input.startISO,
    endAt: input.endISO,
    capacity: input.capacity,
    locationType: input.locationType,
    location: input.location,
    address: input.address ? toAddressDto(input.address) : null,
    notes: input.notes ?? null,
    recurrence:
      input.recurring === "weekly"
        ? { intervalWeeks: 1, weekdays: [isoWeekdayInTimezone(input.startISO, verifiedMetadata().timezone ?? "UTC")], endsOn: null }
        : null,
  };
}

function patchPayload(patch: Partial<SessionInput>): SessionPatchDto {
  const payload: SessionPatchDto = {};
  if (patch.serviceId !== undefined) payload.serviceId = patch.serviceId;
  if (patch.startISO !== undefined) payload.startAt = patch.startISO;
  if (patch.endISO !== undefined) payload.endAt = patch.endISO;
  if (patch.capacity !== undefined) payload.capacity = patch.capacity;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.locationType !== undefined) payload.locationType = patch.locationType;
  if (patch.location !== undefined) payload.location = patch.location;
  if ("address" in patch) {
    payload.address = patch.address ? toAddressDto(patch.address) : null;
  }
  if ("notes" in patch) payload.notes = patch.notes ?? null;
  return payload;
}

export async function listSessions(): Promise<SessionItem[]> {
  if (dataSource === "api") {
    return (await apiListAll<SessionListDto["items"][number]>("/sessions", 500)).map(mapSession);
  }
  await sleep(60);
  return [...mock];
}

export async function getSession(id: string, fresh = false): Promise<SessionItem | null> {
  if (dataSource === "api") {
    try {
      return mapSession(
        await apiRequest<SessionDto>(`/sessions/${encodeURIComponent(id)}`, {cache: !fresh}),
      );
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  }
  await sleep(40);
  return mock.find((s) => s.id === id) ?? null;
}

export async function createSession(input: SessionInput): Promise<SessionItem> {
  if (dataSource === "api") {
    return mapSession(
      await apiRequest<SessionDto, SessionCreateDto>("/sessions", {
        method: "POST",
        body: createPayload(input),
        csrf: true,
      }),
    );
  }
  await sleep(120);
  const created: SessionItem = {
    version: 1, ...input, id: makeId("ses") };
  mock = [...mock, created];
  return created;
}

export type SessionReview = { impactRevision: string; idempotencyKey: string };
export type SessionImpact = {sessionCount: number; activeBookingCount: number; paidBookingCount: number; revision: string};
export async function previewSessionChange(id: string, scope: SessionUpdateScope): Promise<SessionImpact> {
  if (dataSource === "api") return apiRequest<components["schemas"]["SessionImpactResponse"]>(`/sessions/${encodeURIComponent(id)}/change-preview?scope=${scope}`, {cache: false});
  const item = mock.find((entry) => entry.id === id);
  if (!item) throw new NotFoundError("session", id);
  const affected = scope === "this" || !item.seriesId ? [item] : mock.filter((entry) => entry.seriesId === item.seriesId && entry.startISO >= item.startISO);
  const {listBookingsBySession} = await import("./bookings.service");
  const active = (await Promise.all(affected.map((entry) => listBookingsBySession(entry.id)))).flat().filter((booking) => ["pending", "confirmed"].includes(booking.status));
  return {sessionCount: affected.length, activeBookingCount: active.length, paidBookingCount: active.filter((booking) => booking.paymentStatus === "paid").length, revision: String(item.version)};
}

export async function updateSession(
  id: string, patch: Partial<SessionInput>, scope: SessionUpdateScope = "this",
  expectedVersion?: number, seriesVersion?: number, review?: SessionReview,
): Promise<SessionItem> {
  if (dataSource === "api") {
    if (!review) throw new ApiRequestError(422, "session_review_required", "Review the session impact before saving.");
    return mapSession(await apiRequest<SessionDto, SessionPatchDto>(`/sessions/${encodeURIComponent(id)}?scope=${scope}`, {
      method: "PATCH", body: patchPayload(patch), csrf: true, expectedVersion,
      idempotencyKey: review.idempotencyKey,
      headers: {"X-Impact-Revision": review.impactRevision, ...(seriesVersion ? {"X-Series-Version": String(seriesVersion)} : {})},
    }));
  }
  await sleep(100);
  const idx = mock.findIndex((entry) => entry.id === id);
  if (idx === -1) throw new NotFoundError("session", id);
  if (expectedVersion !== undefined && mock[idx].version !== expectedVersion) throw new ApiRequestError(409, "resource_stale", "Review the latest session before saving.");
  if (patch.serviceId !== undefined && patch.serviceId !== mock[idx].serviceId) {
    const {listBookingsBySession} = await import("./bookings.service");
    if ((await listBookingsBySession(id)).length) throw new ApiRequestError(409, "session_service_in_use", "A session with booking history cannot change its service.");
  }
  const affected = scope === "this" || !mock[idx].seriesId ? [mock[idx]] : mock.filter((entry) => entry.seriesId === mock[idx].seriesId && entry.startISO >= mock[idx].startISO);
  if (patch.capacity !== undefined && affected.some((entry) => entry.bookedCount > patch.capacity!)) throw new ApiRequestError(409, "session_capacity_in_use", "Capacity cannot be lower than the active booking count.");
  const ids = affected.map((entry) => entry.id);
  const startDelta = patch.startISO ? Date.parse(patch.startISO) - Date.parse(mock[idx].startISO) : 0;
  const endDelta = patch.endISO ? Date.parse(patch.endISO) - Date.parse(mock[idx].endISO) : 0;
  mock = mock.map((entry) => ids.includes(entry.id) ? {...entry, ...patch,
    ...(patch.startISO ? {startISO: new Date(Date.parse(entry.startISO) + startDelta).toISOString()} : {}),
    ...(patch.endISO ? {endISO: new Date(Date.parse(entry.endISO) + endDelta).toISOString()} : {}),
    version: (entry.version ?? 1) + 1} : entry);
  return mock.find((entry) => entry.id === id)!;
}

export async function cancelSession(id: string, expectedVersion?: number, scope: SessionUpdateScope = "this", seriesVersion?: number, review?: SessionReview): Promise<SessionItem> {
  if (dataSource === "api") {
    if (!review) throw new ApiRequestError(422, "session_review_required", "Review the session impact before cancelling.");
    return mapSession(await apiRequest<SessionDto>(`/sessions/${encodeURIComponent(id)}/cancel?scope=${scope}`, {
      method: "POST", csrf: true, expectedVersion, idempotencyKey: review.idempotencyKey,
      headers: {"X-Impact-Revision": review.impactRevision, ...(seriesVersion ? {"X-Series-Version": String(seriesVersion)} : {})},
    }));
  }
  const bookingService = await import("./bookings.service");
  const result = await updateSession(id, {status: "cancelled", bookedCount: 0}, scope, expectedVersion);
  const ids = scope === "this" || !result.seriesId ? [id] : mock.filter((entry) => entry.seriesId === result.seriesId && entry.startISO >= result.startISO).map((entry) => entry.id);
  bookingService.cancelMockSessionBookings(ids);
  return result;
}

export async function findConflict(
  candidate: { startISO: string; endISO: string; id?: string },
): Promise<SessionItem | null> {
  if (dataSource === "api") {
    const start = new Date(candidate.startISO).getTime();
    const end = new Date(candidate.endISO).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    // Sessions are filtered by start time, so look back a day to catch long ones.
    const from = new Date(start - 24 * 60 * 60 * 1000).toISOString();
    const before = new Date(end).toISOString();
    const response = await apiRequest<SessionListDto>(
      `/sessions?startsFrom=${encodeURIComponent(from)}&startsBefore=${encodeURIComponent(before)}&limit=500`,
    );
    return sessionOverlaps(candidate, response.items.map(mapSession));
  }
  await sleep(20);
  return sessionOverlaps(candidate, mock);
}

export async function listBookableSessions(offset = 0, serviceId?: string): Promise<{ items: SessionItem[]; total: number }> {
  if (dataSource === "api") {
    const page = await apiRequest<SessionListDto>(`/sessions?bookable=true&limit=50&offset=${offset}${serviceId ? `&serviceId=${encodeURIComponent(serviceId)}` : ""}`);
    return { items: page.items.map(mapSession), total: page.total };
  }
  // The showcase uses its fixed demo calendar, independent of the real clock.
  await sleep(60);
  const items = mock.filter((s) => s.status === "scheduled" && s.bookedCount < s.capacity && (!serviceId || s.serviceId === serviceId));
  return { items: items.slice(offset, offset + 50), total: items.length };
}


/** Complete only the requested visible interval, never the workspace's history. */
export async function listSessionsInRange(startsFrom: string, startsBefore: string, signal?: AbortSignal): Promise<SessionItem[]> {
  if (dataSource === "mock") return mock.filter((item) => item.endISO > startsFrom && item.startISO < startsBefore);
  const items: SessionItem[] = [];
  for (let offset = 0; ; offset += 200) {
    const params = new URLSearchParams({ startsFrom, startsBefore, limit: "200", offset: String(offset) });
    const page = await apiRequest<SessionListDto>(`/sessions?${params}`, { signal });
    items.push(...page.items.map(mapSession));
    if (items.length >= page.total || page.items.length === 0) return items;
  }
}
