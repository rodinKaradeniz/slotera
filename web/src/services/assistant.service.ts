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
const titledThreads = new Set<string>();
const briefingThreads = new Set<string>();
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
    dailyAnswers: turns.filter((turn) => turn.status === "completed").length,
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
    titledThreads.clear();
    briefingThreads.clear();
  }
  return getAIStatus();
}
export async function clearAIHistory(): Promise<void> {
  if (dataSource === "api")
    return apiRequest<void>("/ai/history", { method: "DELETE", csrf: true });
  threads = [];
  turns = [];
  replays.clear();
  titledThreads.clear();
  briefingThreads.clear();
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
    items: threads.filter((t) => !briefingThreads.has(t.id)).slice(offset, offset + 25),
    total: threads.filter((t) => !briefingThreads.has(t.id)).length,
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
  briefingThreads.delete(id);
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
  if (!titledThreads.has(id)) {
    const thread = threads.find((thread) => thread.id === id);
    if (thread) thread.title = prompt.trim().split(/\s+/).slice(0, 5).join(" ");
    titledThreads.add(id);
  }
  turns = [...turns, row];
  replays.set(key, row);
  return row;
}
/** A client briefing: one per client, cached and refreshed on request. */
export async function generateBriefing(
  clientId: string,
  language: Lang,
  key: string,
  refresh = false,
): Promise<AITurn> {
  if (dataSource === "api")
    return apiRequest<AITurn, components["schemas"]["BriefInput"]>(
      `/ai/briefings/client?clientId=${encodeURIComponent(clientId)}`,
      {
        method: "POST",
        csrf: true,
        idempotencyKey: key,
        body: { language, refresh },
      },
    );
  const t = await createAIThread(clientId, "Briefing");
  briefingThreads.add(t.id);
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
  clientId: string,
  signal?: AbortSignal,
): Promise<AITurn | null> {
  if (dataSource === "api")
    return apiRequest<AITurn | null>(
      `/ai/briefings/client?clientId=${encodeURIComponent(clientId)}`,
      { ...options, signal },
    );
  return turns.findLast((t) => t.threadId === clientId) ?? null;
}
export async function retryAIIndex(): Promise<void> {
  if (dataSource === "api")
    return apiRequest<void>("/ai/index/retry", { method: "POST", csrf: true });
}

export async function stopAITurn(
  id: string,
  key: string,
  prompt: string,
  language: Lang,
): Promise<void> {
  if (dataSource === "api")
    return apiRequest<void, components["schemas"]["StopInput"]>(
      `/ai/threads/${encodeURIComponent(id)}/stop`,
      { method: "POST", csrf: true, body: { key, prompt, language } },
    );
  const row = replays.get(key);
  if (row && row.prompt !== prompt) throw new Error("The request changed");
  if (row?.status === "completed") return;
  if (row) {
    row.status = "failed";
    row.errorCode = "ai_cancelled";
    return;
  }
  if (!threads.some((thread) => thread.id === id))
    throw new Error("Conversation not found");
  const stopped: AITurn = {
    id: crypto.randomUUID(),
    threadId: id,
    prompt,
    language,
    answer: "",
    status: "failed",
    errorCode: "ai_cancelled",
    createdAt: new Date().toISOString(),
    proposal: null,
    citations: [],
  };
  turns = [...turns, stopped];
  replays.set(key, stopped);
}
export async function branchAIThread(
  id: string,
  turnId: string,
  newId: string,
  title: string,
): Promise<AIThread> {
  if (dataSource === "api")
    return apiRequest<AIThread, components["schemas"]["BranchInput"]>(
      `/ai/threads/${encodeURIComponent(id)}/branch`,
      { method: "POST", csrf: true, body: { turnId, threadId: newId, title } },
    );
  const source = turns.find((row) => row.id === turnId && row.threadId === id);
  if (!source) throw new Error("Conversation not found");
  const thread = await createAIThread(newId, title);
  const history = turns.filter((row) => row.threadId === id);
  if (!turns.some((row) => row.threadId === newId))
    turns = [
      ...turns,
      ...history
        .slice(
          0,
          history.findIndex((row) => row.id === source.id),
        )
        .map((row) => ({
          ...row,
          id: crypto.randomUUID(),
          threadId: newId,
          proposal: null,
        })),
    ];
  return thread;
}
