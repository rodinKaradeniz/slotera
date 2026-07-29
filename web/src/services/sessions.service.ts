import sessionsJson from "@/data/mock/sessions.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import { sessionOverlaps } from "@/lib/calendar";
import type { SessionItem, SessionInput } from "@/types/session";
import { ApiRequestError, NotFoundError, NotImplementedError } from "./_errors";

type AddressDto = components["schemas"]["Address"];
type SessionDto = components["schemas"]["SchedulingSessionResponse"];
type SessionListDto = components["schemas"]["SessionListResponse"];
type SessionCreateDto = components["schemas"]["SessionCreate"];
type SessionPatchDto = components["schemas"]["SessionPatch"];

export type SessionUpdateScope = "this" | "this_and_following";

let mock: SessionItem[] = JSON.parse(JSON.stringify(sessionsJson)) as SessionItem[];

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

function isoWeekday(startISO: string): number {
  const day = new Date(startISO).getUTCDay();
  return day === 0 ? 7 : day;
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
        ? { intervalWeeks: 1, weekdays: [isoWeekday(input.startISO)], endsOn: null }
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
    const response = await apiRequest<SessionListDto>("/sessions?limit=500");
    return response.items.map(mapSession);
  }
  await sleep(60);
  return [...mock];
}

export async function getSession(id: string): Promise<SessionItem | null> {
  if (dataSource === "api") {
    try {
      return mapSession(
        await apiRequest<SessionDto>(`/sessions/${encodeURIComponent(id)}`),
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
  const created: SessionItem = { ...input, id: makeId("ses") };
  mock = [...mock, created];
  return created;
}

export async function updateSession(
  id: string,
  patch: Partial<SessionInput>,
  scope: SessionUpdateScope = "this",
): Promise<SessionItem> {
  if (dataSource === "api") {
    return mapSession(
      await apiRequest<SessionDto, SessionPatchDto>(
        `/sessions/${encodeURIComponent(id)}?scope=${scope}`,
        { method: "PATCH", body: patchPayload(patch), csrf: true },
      ),
    );
  }
  await sleep(100);
  const idx = mock.findIndex((s) => s.id === id);
  if (idx === -1) throw new NotFoundError("session", id);
  const next: SessionItem = { ...mock[idx], ...patch };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function cancelSession(id: string): Promise<SessionItem> {
  return updateSession(id, { status: "cancelled" });
}

export async function findConflict(
  candidate: { startISO: string; endISO: string; id?: string },
): Promise<SessionItem | null> {
  if (dataSource !== "mock") throw new NotImplementedError("findConflict");
  await sleep(20);
  return sessionOverlaps(candidate, mock);
}
