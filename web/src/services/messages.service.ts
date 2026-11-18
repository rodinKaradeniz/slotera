import { mockData } from "@/services/adapters/mock-data";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { currentSession } from "@/services/auth.service";
import { listClients } from "@/services/clients.service";

export type Message = components["schemas"]["Message"];
export type MessagePage = components["schemas"]["MessagePage"];
export type ConversationPage = components["schemas"]["ConversationPage"];
const mock = new Map<string, Message[]>();
let seeded: Promise<void> | null = null;
function seedConversation(): Promise<void> {
  return (seeded ??= (async () => {
    const clients = await listClients();
    const client = clients.find((c) => c.name.includes("Sofia"));
    if (!client) return;
    mock.set(client.id, mockData<Message[]>("conversation-messages"));
  })());
}
const submissions = new Map<string, { body: string; message: Message }>();
const reads = new Map<string, number>();
const pathFor = (clientId?: string) =>
  clientId
    ? `/clients/${encodeURIComponent(clientId)}/conversation`
    : "/client/conversation";
const optionsFor = (clientId?: string) => ({
  cache: false,
  ...(clientId ? {} : { authKind: "client" as const }),
});
export async function listConversations(
  offset = 0,
  signal?: AbortSignal,
): Promise<ConversationPage> {
  if (dataSource === "api")
    return apiRequest<ConversationPage>(
      `/conversations?limit=25&offset=${offset}`,
      { signal },
    );
  await seedConversation();
  const clients = await listClients();
  const byId = new Map(clients.map((client) => [client.id, client]));
  const all = [...mock.entries()]
    .filter(([id]) => byId.has(id))
    .map(([id, messages]) => ({ id, messages }))
    .sort(
      (a, b) =>
        (b.messages.at(-1)?.createdAt ?? "").localeCompare(
          a.messages.at(-1)?.createdAt ?? "",
        ) || a.id.localeCompare(b.id),
    );
  return {
    items: all.slice(offset, offset + 25).map(({ id, messages }) => ({
      clientId: id,
      clientName: byId.get(id)!.name,
      lastSequence: messages.length,
      unreadCount: 0,
    })),
    total: all.length,
    limit: 25,
    offset,
  };
}
export async function listMessages(
  clientId?: string,
  options: { before?: number; after?: number; signal?: AbortSignal } = {},
): Promise<MessagePage> {
  if (dataSource === "api")
    return apiRequest<MessagePage>(
      `${pathFor(clientId)}/messages?limit=25${options.before ? `&before=${options.before}` : ""}${options.after !== undefined ? `&after=${options.after}` : ""}`,
      { ...optionsFor(clientId), signal: options.signal },
    );
  await seedConversation();
  const all = mock.get(clientId ?? "demo") ?? [];
  const matching = all.filter(
    (m) =>
      (!options.before || m.sequence < options.before) &&
      (options.after === undefined || m.sequence > options.after),
  );
  return {
    items:
      options.after === undefined ? matching.slice(-25) : matching.slice(0, 25),
    latestSequence: all.length,
    readThrough: reads.get(clientId ?? "demo") ?? 0,
    limit: 25,
  };
}
export async function sendMessage(
  clientId: string | undefined,
  body: string,
  submissionId: string,
): Promise<Message> {
  if (dataSource === "api")
    return apiRequest<Message, { body: string; submissionId: string }>(
      `${pathFor(clientId)}/messages`,
      {
        ...optionsFor(clientId),
        method: "POST",
        csrf: true,
        body: { body, submissionId },
      },
    );
  const key = `${clientId}:${submissionId}`;
  const existing = submissions.get(key);
  if (existing) {
    if (existing.body !== body) throw new Error("Submission changed");
    return existing.message;
  }
  const messages = mock.get(clientId ?? "demo") ?? [];
  const message: Message = {
    id: crypto.randomUUID(),
    body,
    sequence: messages.length + 1,
    senderKind: currentSession() ? "operator" : "client",
    createdAt: new Date().toISOString(),
  };
  mock.set(clientId ?? "demo", [...messages, message]);
  submissions.set(key, { body, message });
  return message;
}
export async function markMessagesRead(
  clientId: string | undefined,
  sequence: number,
) {
  if (dataSource === "api")
    return apiRequest<void, { sequence: number }>(`${pathFor(clientId)}/read`, {
      ...optionsFor(clientId),
      method: "POST",
      csrf: true,
      body: { sequence },
    });
  reads.set(
    clientId ?? "demo",
    Math.max(sequence, reads.get(clientId ?? "demo") ?? 0),
  );
}
