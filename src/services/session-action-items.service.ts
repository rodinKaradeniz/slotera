import actionItemsJson from "@/data/mock/session-action-items.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type {
  SessionActionItem,
  SessionActionItemInput,
} from "@/types/session-action-item";
import { NotFoundError, NotImplementedError } from "./_errors";

/**
 * Session action items. Mirrors the mock-first conventions of the other
 * services (see CLAUDE.md → Data layer). Lightweight admin tasks attached to a
 * session; `clientVisible` is retained for a future customer-facing surface
 * (admin-only today). Internal-only items stay admin-side.
 */
let mock: SessionActionItem[] = JSON.parse(
  JSON.stringify(actionItemsJson),
) as SessionActionItem[];

export async function listActionItems(): Promise<SessionActionItem[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listActionItems");
  await sleep(50);
  return [...mock];
}

export async function listActionItemsForSession(
  sessionId: string,
): Promise<SessionActionItem[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listActionItemsForSession");
  await sleep(50);
  return mock.filter((a) => a.sessionId === sessionId);
}

export async function createActionItem(
  input: SessionActionItemInput,
): Promise<SessionActionItem> {
  if (dataSource !== "mock") throw new NotImplementedError("createActionItem");
  await sleep(90);
  const now = new Date().toISOString();
  const created: SessionActionItem = {
    ...input,
    id: makeId("act"),
    createdAtISO: now,
    updatedAtISO: now,
  };
  mock = [...mock, created];
  return created;
}

export async function updateActionItem(
  id: string,
  patch: Partial<SessionActionItemInput>,
): Promise<SessionActionItem> {
  if (dataSource !== "mock") throw new NotImplementedError("updateActionItem");
  await sleep(80);
  const idx = mock.findIndex((a) => a.id === id);
  if (idx === -1) throw new NotFoundError("session action item", id);
  const next: SessionActionItem = {
    ...mock[idx],
    ...patch,
    updatedAtISO: new Date().toISOString(),
  };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function toggleActionItemStatus(
  id: string,
): Promise<SessionActionItem> {
  const current = mock.find((a) => a.id === id);
  if (!current) throw new NotFoundError("session action item", id);
  return updateActionItem(id, {
    status: current.status === "done" ? "todo" : "done",
  });
}

export async function deleteActionItem(id: string): Promise<void> {
  if (dataSource !== "mock") throw new NotImplementedError("deleteActionItem");
  await sleep(70);
  mock = mock.filter((a) => a.id !== id);
}
