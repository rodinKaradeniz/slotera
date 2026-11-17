import { QueryClient } from "@tanstack/react-query";

// Browser memory only: no private data is persisted or shared across server requests.
let client: QueryClient | undefined;
let scope: string | null = null;
type Metadata = {currency?: import("@/types/common").Currency; timezone?: string; language?: "en" | "tr" | "de"};
let metadata: Metadata = {};
export function verifiedMetadata(): Metadata { return metadata; }
export function updateVerifiedMetadata(next: Metadata): void { if (scope) metadata = {...metadata, ...next}; }
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let verifier: (() => Promise<unknown>) | undefined;
export const DATA_CHANGED = "slotera-data-changed";
export function queryClient(): QueryClient {
  return client ??= new QueryClient({ defaultOptions: { queries: {
    staleTime: 30_000, gcTime: 300_000, retry: false,
  } } });
}
export function verifiedScope(): string | null { return scope; }
export function clearQueryScope(): void {
  scope = null;
  metadata = {};
  clearTimeout(expiryTimer);
  client?.clear();
}
export function setQueryScope(identity: string, expiresAt: string, nextMetadata: Metadata = {}): void {
  metadata = nextMetadata;
  if (scope !== identity) { client?.clear(); scope = identity; }
  clearTimeout(expiryTimer);
  const schedule = () => {
    const remaining = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(remaining)) return;
    expiryTimer = setTimeout(() => {
      if (Date.parse(expiresAt) > Date.now()) {schedule(); return;}
      clearQueryScope();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("slotera-auth-expired"));
    }, Math.max(0, Math.min(remaining, 2_147_483_647)));
  };
  schedule();
}
export async function invalidateReads(notify = true, resources?: string[]): Promise<void> {
  await client?.invalidateQueries(resources ? {predicate: (query) => {
    const path = query.queryKey[2];
    return typeof path === "string" && resources.some((resource) => path === `/${resource}` || path.startsWith(`/${resource}/`) || path.startsWith(`/${resource}?`));
  }} : undefined);
  if (notify && typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED));
}
export function setSessionVerifier(callback: () => Promise<unknown>): void { verifier = callback; }
let installed = false;
export function installQueryEvents(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let refreshing = false;
  const refresh = async () => {
    if (!scope || refreshing || document.visibilityState === "hidden") return;
    refreshing = true;
    try { await verifier?.(); await invalidateReads(); }
    catch { window.dispatchEvent(new Event(DATA_CHANGED)); }
    finally { refreshing = false; }
  };
  window.addEventListener("focus", () => { void refresh(); });
  window.addEventListener("online", () => { void refresh(); });
}

export function relatedReads(path: string): string[] {
  if (path === "/auth/preferences") return [];
  const root = path.split(/[/?]/)[1];
  const related: Record<string, string[]> = {
    ai: ["ai", "bookings", "clients", "services", "packages", "sessions", "tasks", "dashboard", "notifications"],
    tasks: ["tasks", "session-action-items", "sessions", "dashboard"],
    conversations: ["conversations", "dashboard"],
    bookings: ["bookings", "sessions", "clients", "dashboard", "notifications", "search"],
    "client-notes": ["client-notes", "clients", "search"],
    "session-action-items": ["tasks", "session-action-items", "sessions", "dashboard", "search"],
    clients: ["conversations", "clients", "bookings", "dashboard", "search"],
    sessions: ["tasks", "sessions", "bookings", "clients", "dashboard", "notifications", "search"],
    services: ["services", "packages", "forms", "sessions", "bookings", "dashboard", "search"],
    forms: ["forms", "bookings", "services", "search"],
    packages: ["packages", "services", "search"],
    settings: ["settings", "availability", "sessions", "dashboard", "search"],
    availability: ["availability", "settings", "sessions", "dashboard", "search"],
    notifications: ["notifications", "dashboard"],
    platform: ["platform"], auth: ["notifications"],
    public: ["bookings", "sessions", "clients", "dashboard", "notifications"],
  };
  return root === "ai" ? related.ai : [...(related[root] ?? [root]), "ai"];
}
