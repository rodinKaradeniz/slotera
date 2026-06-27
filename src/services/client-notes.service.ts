import clientNotesJson from "@/data/mock/client-notes.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { ClientNote, ClientNoteInput } from "@/types/client-note";
import { NotFoundError, NotImplementedError } from "./_errors";

/**
 * Client notes. Mirrors the mock-first conventions of the other services (see
 * CLAUDE.md → Data layer). Separate internal note entries about a client —
 * admin-only, never shown to clients. Newest first.
 */
let mock: ClientNote[] = JSON.parse(
  JSON.stringify(clientNotesJson),
) as ClientNote[];

function byNewest(a: ClientNote, b: ClientNote): number {
  return b.updatedAtISO.localeCompare(a.updatedAtISO);
}

export async function listClientNotes(clientId: string): Promise<ClientNote[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listClientNotes");
  await sleep(50);
  return mock.filter((n) => n.clientId === clientId).sort(byNewest);
}

export async function createClientNote(
  input: ClientNoteInput,
): Promise<ClientNote> {
  if (dataSource !== "mock") throw new NotImplementedError("createClientNote");
  await sleep(90);
  const now = new Date().toISOString();
  const created: ClientNote = {
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
): Promise<ClientNote> {
  if (dataSource !== "mock") throw new NotImplementedError("updateClientNote");
  await sleep(80);
  const idx = mock.findIndex((n) => n.id === id);
  if (idx === -1) throw new NotFoundError("client note", id);
  const next: ClientNote = {
    ...mock[idx],
    ...patch,
    updatedAtISO: new Date().toISOString(),
  };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deleteClientNote(id: string): Promise<void> {
  if (dataSource !== "mock") throw new NotImplementedError("deleteClientNote");
  await sleep(70);
  mock = mock.filter((n) => n.id !== id);
}
