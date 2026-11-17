import { NotImplementedError } from "./_errors";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import type { Lang } from "@/lib/i18n";
export type AIStatus = components["schemas"]["AIStatus"];
export type AITurn = components["schemas"]["TurnView"];
export type AIThread = components["schemas"]["ThreadView"];
type Page<T> = { items: T[]; total: number; limit: number; offset: number };
let enabled = false,
  revision = 1;
let threads: AIThread[] = [];
let turns: AITurn[] = [];
const replays = new Map<string, AITurn>();
const options = { cache: false };
export async function getAIStatus(signal?: AbortSignal): Promise<AIStatus> {
  if (dataSource === "api")
    return apiRequest<AIStatus>("/ai/status", { ...options, signal });
  return {
    enabled,
    available: true,
    simulated: true,
    revision,
    privacyEpoch: revision,
    pending: 0,
    failed: 0,
    indexed: 8,
    dailyAnswers: turns.length,
    dailyTokens: 0,
    indexingTokens: 0,
    answerLimit: 50,
    tokenLimit: 250000,
    indexingLimit: 100000,
    timezone: "Europe/London",
    resetsAt: new Date(Date.now() + 86400000).toISOString(),
  };
}
export async function configureAI(
  value: boolean,
  reviewed: number,
): Promise<AIStatus> {
  if (dataSource === "api")
    return apiRequest<AIStatus, components["schemas"]["SettingsInput"]>(
      "/ai/settings",
      {
        method: "PATCH",
        csrf: true,
        body: { enabled: value, revision: reviewed },
      },
    );
  if (reviewed !== revision) throw new Error("Review the latest settings.");
  enabled = value;
  revision++;
  if (!enabled) {
    threads = [];
    turns = [];
    replays.clear();
  }
  return getAIStatus();
}
export async function clearAIHistory(): Promise<void> {
  if (dataSource === "api")
    return apiRequest<void>("/ai/history", { method: "DELETE", csrf: true });
  threads = [];
  turns = [];
  replays.clear();
}
export async function listAIThreads(
  offset = 0,
  signal?: AbortSignal,
): Promise<Page<AIThread>> {
  if (dataSource === "api")
    return apiRequest<Page<AIThread>>(`/ai/threads?limit=25&offset=${offset}`, {
      ...options,
      signal,
    });
  return {
    items: threads.slice(offset, offset + 25),
    total: threads.length,
    limit: 25,
    offset,
  };
}
export async function createAIThread(
  id: string,
  title: string,
): Promise<AIThread> {
  if (dataSource === "api")
    return apiRequest<AIThread, components["schemas"]["ThreadInput"]>(
      "/ai/threads",
      { method: "POST", csrf: true, body: { id, title } },
    );
  const old = threads.find((t) => t.id === id);
  if (old) return old;
  const row = { id, title, createdAt: new Date().toISOString() };
  threads = [row, ...threads];
  return row;
}
export async function deleteAIThread(id: string): Promise<void> {
  if (dataSource === "api")
    return apiRequest<void>(`/ai/threads/${encodeURIComponent(id)}`, {
      method: "DELETE",
      csrf: true,
    });
  threads = threads.filter((t) => t.id !== id);
  turns = turns.filter((t) => t.threadId !== id);
}
export async function listAITurns(
  id: string,
  offset = 0,
  signal?: AbortSignal,
): Promise<Page<AITurn>> {
  if (dataSource === "api")
    return apiRequest<Page<AITurn>>(
      `/ai/threads/${encodeURIComponent(id)}/turns?limit=25&offset=${offset}`,
      { ...options, signal },
    );
  const all = turns.filter((t) => t.threadId === id);
  return {
    items: all.slice(
      Math.max(0, all.length - offset - 25),
      all.length - offset,
    ),
    total: all.length,
    limit: 25,
    offset,
  };
}
export async function generateAITurn(
  id: string,
  prompt: string,
  language: Lang,
  key: string,
): Promise<AITurn> {
  if (dataSource === "api")
    return apiRequest<AITurn, components["schemas"]["TurnInput"]>(
      `/ai/threads/${encodeURIComponent(id)}/turns`,
      {
        method: "POST",
        csrf: true,
        idempotencyKey: key,
        body: { prompt, language },
      },
    );
  if (replays.has(key)) return replays.get(key)!;
  const row: AITurn = {
    id: crypto.randomUUID(),
    threadId: id,
    prompt,
    language,
    answer: {
      en: "Simulated assistant: open Bookings to review booking details, Calendar to organize time, or Clients for private client context.",
      tr: "Simüle asistan: rezervasyon ayrıntıları için Rezervasyonlar, zaman planlaması için Takvim ve özel danışan bilgileri için Danışanlar sayfasını açın.",
      de: "Simulierter Assistent: Buchungen zeigt Buchungsdetails, Kalender organisiert Termine und Kunden enthält private Kundennotizen.",
    }[language],
    status: "completed",
    citations: [{ id: "help", title: "Slotera", href: "/admin/bookings" }],
    proposal: null,
    errorCode: null,
    createdAt: new Date().toISOString(),
  };
  turns = [...turns, row];
  replays.set(key, row);
  return row;
}
export async function generateBriefing(
  kind: "daily" | "client",
  language: Lang,
  key: string,
  refresh = false,
  clientId?: string,
): Promise<AITurn> {
  if (dataSource === "api")
    return apiRequest<AITurn, components["schemas"]["BriefInput"]>(
      `/ai/briefings/${kind}${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`,
      {
        method: "POST",
        csrf: true,
        idempotencyKey: key,
        body: { language, refresh },
      },
    );
  const t = await createAIThread(clientId ?? "daily", "Briefing");
  return generateAITurn(t.id, "Briefing", language, key);
}
export async function recoverAI(id: string): Promise<AITurn> {
  if (dataSource === "api")
    return apiRequest<AITurn>(
      `/ai/operations/${encodeURIComponent(id)}`,
      options,
    );
  return turns.find((t) => t.id === id)!;
}
export async function confirmAI(
  id: string,
  hash: string,
  key: string,
): Promise<AITurn> {
  if (dataSource !== "api") throw new NotImplementedError("confirmAI");
  return apiRequest<AITurn, components["schemas"]["ConfirmInput"]>(
    `/ai/proposals/${encodeURIComponent(id)}/confirm`,
    {
      method: "POST",
      csrf: true,
      idempotencyKey: key,
      body: { proposalHash: hash },
    },
  );
}

export async function getBriefing(
  kind: "daily" | "client",
  clientId?: string,
  signal?: AbortSignal,
): Promise<AITurn | null> {
  if (dataSource === "api")
    return apiRequest<AITurn | null>(
      `/ai/briefings/${kind}${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`,
      { ...options, signal },
    );
  return turns.findLast((t) => t.threadId === (clientId ?? "daily")) ?? null;
}
export async function retryAIIndex(): Promise<void> {
  if (dataSource === "api")
    return apiRequest<void>("/ai/index/retry", { method: "POST", csrf: true });
}
