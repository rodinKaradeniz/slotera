import sessionsJson from "@/data/mock/sessions.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import { sessionOverlaps } from "@/lib/calendar";
import type { SessionItem, SessionInput } from "@/types/session";
import { NotFoundError, NotImplementedError } from "./_errors";

let mock: SessionItem[] = JSON.parse(JSON.stringify(sessionsJson)) as SessionItem[];

export async function listSessions(): Promise<SessionItem[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listSessions");
  await sleep(60);
  return [...mock];
}

export async function getSession(id: string): Promise<SessionItem | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getSession");
  await sleep(40);
  return mock.find((s) => s.id === id) ?? null;
}

export async function createSession(input: SessionInput): Promise<SessionItem> {
  if (dataSource !== "mock") throw new NotImplementedError("createSession");
  await sleep(120);
  const created: SessionItem = { ...input, id: makeId("ses") };
  mock = [...mock, created];
  return created;
}

export async function updateSession(
  id: string,
  patch: Partial<SessionInput>,
): Promise<SessionItem> {
  if (dataSource !== "mock") throw new NotImplementedError("updateSession");
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
  await sleep(20);
  return sessionOverlaps(candidate, mock);
}
