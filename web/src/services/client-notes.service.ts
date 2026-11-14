import { mockData } from "@/services/adapters/mock-data";
import { nextEditVersion } from "./_editing";

import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { ClientNote, ClientNoteInput } from "@/types/client-note";
import { NotFoundError } from "./_errors";

type ClientNoteDto = components["schemas"]["ClientNoteResponse"];
type ClientNoteListDto = components["schemas"]["ClientNoteListResponse"];
type ClientNoteCreateDto = components["schemas"]["ClientNoteCreate"];
type ClientNotePatchDto = components["schemas"]["ClientNotePatch"];

/**
 * Client notes. Mirrors the mock-first conventions of the other services (see
 * CLAUDE.md → Data layer). Separate internal note entries about a client —
 * admin-only, never shown to clients. Newest first.
 */
let mock: ClientNote[] = dataSource === "mock" ? mockData("client-notes") : [] as ClientNote[];
mock = mock.map((item) => ({...item, version: item.version ?? 1}));

function byNewest(a: ClientNote, b: ClientNote): number {
  return b.updatedAtISO.localeCompare(a.updatedAtISO);
}

function mapClientNote(note: ClientNoteDto): ClientNote {
  return {
    version: note.version,
    id: note.id,
    clientId: note.clientId,
    title: note.title,
    body: note.body,
    createdAtISO: note.createdAt,
    updatedAtISO: note.updatedAt,
  };
}

export async function listClientNotes(clientId: string): Promise<ClientNote[]> {
  if (dataSource === "api") {
    const response = await apiRequest<ClientNoteListDto>(
      `/clients/${encodeURIComponent(clientId)}/notes`,
    );
    return response.items.map(mapClientNote);
  }
  await sleep(50);
  return mock.filter((n) => n.clientId === clientId).sort(byNewest);
}

export async function createClientNote(
  input: ClientNoteInput,
): Promise<ClientNote> {
  if (dataSource === "api") {
    const payload: ClientNoteCreateDto = {
      title: input.title,
      body: input.body,
    };
    return mapClientNote(
      await apiRequest<ClientNoteDto, ClientNoteCreateDto>(
        `/clients/${encodeURIComponent(input.clientId)}/notes`,
        { method: "POST", body: payload, csrf: true },
      ),
    );
  }
  await sleep(90);
  const now = new Date().toISOString();
  const created: ClientNote = {
    version: 1,
    ...input,
    id: makeId("cnote"),
    createdAtISO: now,
    updatedAtISO: now,
  };
  mock = [created, ...mock];
  return created;
}

export async function updateClientNote(
  id: string,
  patch: Partial<Pick<ClientNoteInput, "title" | "body">>,
  expectedVersion?: number,
): Promise<ClientNote> {
  if (dataSource === "api") {
    const payload: ClientNotePatchDto = { ...patch };
    return mapClientNote(
      await apiRequest<ClientNoteDto, ClientNotePatchDto>(
        `/client-notes/${encodeURIComponent(id)}`,
        { method: "PATCH", expectedVersion, body: payload, csrf: true },
      ),
    );
  }
  await sleep(80);
  const idx = mock.findIndex((n) => n.id === id);
  if (idx === -1) throw new NotFoundError("client note", id);
  const next: ClientNote = {
    ...mock[idx],
    ...patch,
    version: nextEditVersion(mock[idx], expectedVersion),
    updatedAtISO: new Date().toISOString(),
  };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deleteClientNote(id: string,
  expectedVersion?: number,
): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>(`/client-notes/${encodeURIComponent(id)}`, {
      method: "DELETE", expectedVersion,
      csrf: true,
    });
    return;
  }
  const reviewed = mock.find((item) => item.id === id);
  if (reviewed) nextEditVersion(reviewed, expectedVersion);
  await sleep(70);
  mock = mock.filter((n) => n.id !== id);
}

export async function getClientNote(id: string): Promise<ClientNote | null> {
  if (dataSource === "mock") return mock.find((item) => item.id === id) ?? null;
  try {return mapClientNote(await apiRequest<ClientNoteDto>(`/client-notes/${encodeURIComponent(id)}`));}
  catch (error) {if (error instanceof Error && "status" in error && error.status === 404) return null; throw error;}
}

export async function listClientNotePage(clientId: string, offset = 0, signal?: AbortSignal) {
  if (dataSource === "api") {
    const page = await apiRequest<ClientNoteListDto>(`/clients/${encodeURIComponent(clientId)}/notes?limit=25&offset=${offset}`, {signal});
    return {...page, items: page.items.map(mapClientNote)};
  }
  const items = await listClientNotes(clientId);
  return {items: items.slice(offset, offset+25), total: items.length, limit: 25, offset};
}
