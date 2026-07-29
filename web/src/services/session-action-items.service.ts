import actionItemsJson from "@/data/mock/session-action-items.json";
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
let mock: SessionActionItem[] = JSON.parse(
  JSON.stringify(actionItemsJson),
) as SessionActionItem[];

function mapActionItem(item: SessionActionItemDto): SessionActionItem {
  return {
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
  if (dataSource === "api") {
    return mapActionItem(
      await apiRequest<SessionActionItemDto, SessionActionItemPatchDto>(
        `/session-action-items/${encodeURIComponent(id)}`,
        { method: "PATCH", body: patchPayload(patch), csrf: true },
      ),
    );
  }
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
  currentStatus: SessionActionItemStatus,
): Promise<SessionActionItem> {
  if (dataSource === "api") {
    return updateActionItem(id, {
      status: currentStatus === "done" ? "todo" : "done",
    });
  }
  const current = mock.find((a) => a.id === id);
  if (!current) throw new NotFoundError("session action item", id);
  return updateActionItem(id, {
    status: current.status === "done" ? "todo" : "done",
  });
}

export async function deleteActionItem(id: string): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>(`/session-action-items/${encodeURIComponent(id)}`, {
      method: "DELETE",
      csrf: true,
    });
    return;
  }
  await sleep(70);
  mock = mock.filter((a) => a.id !== id);
}
