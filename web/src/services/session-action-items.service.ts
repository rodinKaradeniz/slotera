import { mockData } from "@/services/adapters/mock-data";
import { nextEditVersion } from "./_editing";

import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type {
  SessionActionItem,
  SessionActionItemStatus,
  SessionActionItemInput,
} from "@/types/session-action-item";
import { NotFoundError, NotImplementedError } from "./_errors";

type SessionActionItemDto = components["schemas"]["SessionActionItemResponse"];
type SessionActionItemListDto =
  components["schemas"]["SessionActionItemListResponse"];
type SessionActionItemCreateDto =
  components["schemas"]["SessionActionItemCreate"];
type SessionActionItemPatchDto =
  components["schemas"]["SessionActionItemPatch"];

/**
 * Session action items. Mirrors the mock-first conventions of the other
 * services (see CLAUDE.md → Data layer). Lightweight admin tasks attached to a
 * session; `clientVisible` is retained for a future customer-facing surface
 * (admin-only today). Internal-only items stay admin-side.
 */
let mock: SessionActionItem[] = dataSource === "mock" ? mockData("session-action-items") : [] as SessionActionItem[];
mock = mock.map((item) => ({...item, version: item.version ?? 1}));

function mapActionItem(item: SessionActionItemDto): SessionActionItem {
  return {
    version: item.version,
    id: item.id,
    sessionId: item.sessionId,
    title: item.title,
    description: item.description ?? undefined,
    status: item.status,
    dueDate: item.dueDate ?? undefined,
    clientVisible: item.clientVisible,
    createdAtISO: item.createdAt,
    updatedAtISO: item.updatedAt,
  };
}

function createPayload(input: SessionActionItemInput): SessionActionItemCreateDto {
  return {
    title: input.title,
    description: input.description ?? null,
    dueDate: input.dueDate ?? null,
    clientVisible: input.clientVisible ?? false,
  };
}

function patchPayload(
  patch: Partial<SessionActionItemInput>,
): SessionActionItemPatchDto {
  return {
    ...patch,
    description: "description" in patch ? patch.description ?? null : undefined,
    dueDate: "dueDate" in patch ? patch.dueDate ?? null : undefined,
  };
}

export async function listActionItems(): Promise<SessionActionItem[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listActionItems");
  await sleep(50);
  return [...mock];
}

export async function listActionItemsForSession(
  sessionId: string,
): Promise<SessionActionItem[]> {
  if (dataSource === "api") {
    const response = await apiRequest<SessionActionItemListDto>(
      `/sessions/${encodeURIComponent(sessionId)}/action-items`,
    );
    return response.items.map(mapActionItem);
  }
  await sleep(50);
  return mock.filter((a) => a.sessionId === sessionId);
}

export async function createActionItem(
  input: SessionActionItemInput,
): Promise<SessionActionItem> {
  if (dataSource === "api") {
    return mapActionItem(
      await apiRequest<SessionActionItemDto, SessionActionItemCreateDto>(
        `/sessions/${encodeURIComponent(input.sessionId)}/action-items`,
        { method: "POST", body: createPayload(input), csrf: true },
      ),
    );
  }
  await sleep(90);
  const now = new Date().toISOString();
  const created: SessionActionItem = {
    version: 1,
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
  expectedVersion?: number,
): Promise<SessionActionItem> {
  if (dataSource === "api") {
    return mapActionItem(
      await apiRequest<SessionActionItemDto, SessionActionItemPatchDto>(
        `/session-action-items/${encodeURIComponent(id)}`,
        { method: "PATCH", expectedVersion, body: patchPayload(patch), csrf: true },
      ),
    );
  }
  await sleep(80);
  const idx = mock.findIndex((a) => a.id === id);
  if (idx === -1) throw new NotFoundError("session action item", id);
  const next: SessionActionItem = {
    ...mock[idx],
    ...patch,
    version: nextEditVersion(mock[idx], expectedVersion),
    updatedAtISO: new Date().toISOString(),
  };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function toggleActionItemStatus(
  id: string,
  currentStatus: SessionActionItemStatus,
  expectedVersion?: number,
): Promise<SessionActionItem> {
  if (dataSource === "api") {
    return updateActionItem(id, {
      status: currentStatus === "done" ? "todo" : "done",
    }, expectedVersion);
  }
  const current = mock.find((a) => a.id === id);
  if (!current) throw new NotFoundError("session action item", id);
  return updateActionItem(id, {
    status: current.status === "done" ? "todo" : "done",
  }, expectedVersion);
}

export async function deleteActionItem(id: string,
  expectedVersion?: number,
): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>(`/session-action-items/${encodeURIComponent(id)}`, {
      method: "DELETE", expectedVersion,
      csrf: true,
    });
    return;
  }
  const reviewed = mock.find((item) => item.id === id);
  if (reviewed) nextEditVersion(reviewed, expectedVersion);
  await sleep(70);
  mock = mock.filter((a) => a.id !== id);
}

export async function getActionItem(id: string): Promise<SessionActionItem | null> {
  if (dataSource === "mock") return mock.find((item) => item.id === id) ?? null;
  try {return mapActionItem(await apiRequest<SessionActionItemDto>(`/session-action-items/${encodeURIComponent(id)}`));}
  catch (error) {if (error instanceof Error && "status" in error && error.status === 404) return null; throw error;}
}

export async function listActionItemPage(sessionId: string, offset = 0, signal?: AbortSignal) {
  if (dataSource === "api") {
    const page = await apiRequest<SessionActionItemListDto>(`/sessions/${encodeURIComponent(sessionId)}/action-items?limit=25&offset=${offset}`, {signal});
    return {...page, items: page.items.map(mapActionItem)};
  }
  const items = await listActionItemsForSession(sessionId);
  return {items: items.slice(offset, offset+25), total: items.length, limit: 25, offset};
}
