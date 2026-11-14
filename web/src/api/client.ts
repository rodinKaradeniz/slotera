import { clearQueryScope, installQueryEvents, invalidateReads, relatedReads, queryClient, verifiedScope } from "./query-cache";
import { apiBaseUrl, csrfCookieName } from "@/lib/env";
import { ApiRequestError } from "@/services/_errors";
import type { components } from "@/api/generated/schema";

type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions<TBody> = {
  method?: HttpMethod;
  signal?: AbortSignal;
  responseType?: "json" | "text";
  cache?: boolean;
  expectedVersion?: number;
  body?: TBody;
  csrf?: boolean;
  idempotencyKey?: string;
  /** Extra request headers, e.g. a customer's booking-link token. */
  headers?: Record<string, string>;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      "message" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      typeof (error as { message: unknown }).message === "string",
  );
}

const MAX_LIST_PAGES = 50;

/**
 * Every item of a paged list endpoint (`items` + `total`), fetched page by page so a
 * long list is never silently cut at the server's page size. `path` may carry filters.
 */
export async function apiListAll<TItem>(path: string, pageSize = 200): Promise<TItem[]> {
  const separator = path.includes("?") ? "&" : "?";
  const items: TItem[] = [];
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const response = await apiRequest<{ items: TItem[]; total: number }>(
      `${path}${separator}limit=${pageSize}&offset=${items.length}`,
    );
    items.push(...response.items);
    if (response.items.length === 0 || items.length >= response.total) break;
  }
  return items;
}

async function request<TResponse, TBody = never>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiRequestError(0, "invalid_api_path", "The API path is invalid.");
  }
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.csrf) {
    const csrfToken = readCookie(csrfCookieName);
    if (!csrfToken) {
      throw new ApiRequestError(
        403,
        "csrf_cookie_missing",
        "Your session could not be verified. Please sign in again.",
      );
    }
    headers.set("X-CSRF-Token", csrfToken);
  }
  if ("expectedVersion" in options) {
    if (!Number.isSafeInteger(options.expectedVersion) || (options.expectedVersion ?? 0) < 1) {
      throw new ApiRequestError(409, "resource_stale", "Reload this item before saving; its reviewed version is missing.");
    }
    headers.set("If-Match", `"v${options.expectedVersion}"`);
  }
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, `${apiBaseUrl.replace(/\/$/, "")}/`), {
      method,
      signal: options.signal,
      headers,
      credentials: "include",
      cache: "no-store",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ApiRequestError(
      0,
      "network_error",
      "Could not reach the Slotera API.",
    );
  }

  if (response.status === 204) return undefined as TResponse;

  if (response.ok && options.responseType === "text") return await response.text() as TResponse;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isErrorEnvelope(payload)) {
      throw new ApiRequestError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.requestId,
        payload.error.details ?? undefined,
      );
    }
    throw new ApiRequestError(
      response.status,
      "unexpected_response",
      "The Slotera API returned an unexpected response.",
      response.headers.get("X-Request-ID") ?? undefined,
    );
  }
  if (payload === null) {
    throw new ApiRequestError(
      response.status,
      "invalid_response",
      "The Slotera API returned an invalid response.",
      response.headers.get("X-Request-ID") ?? undefined,
    );
  }
  return payload as TResponse;
}


const readers = new Map<string, number>();

export async function apiRequest<TResponse, TBody = never>(path: string, options: RequestOptions<TBody> = {}): Promise<TResponse> {
  const method = options.method ?? "GET";
  const identity = verifiedScope();
  const cacheable = typeof window !== "undefined" && method === "GET" && Boolean(identity)
    && options.cache !== false && !options.headers && !options.responseType
    && !path.startsWith("/auth/") && !path.startsWith("/public/") && !path.includes("/export");
  installQueryEvents();
  try {
    if (cacheable) {
      const key = JSON.stringify([identity, path]);
      const queryKey = ["api", identity, path];
      readers.set(key, (readers.get(key) ?? 0) + 1);
      const execute = () => queryClient().fetchQuery({
        queryKey,
        staleTime: /^\/(settings|services|forms|packages|availability)(?:[/?]|$)/.test(path) ? 300_000 : 30_000,
        queryFn: ({ signal }) => request<TResponse, TBody>(path, { ...options, signal }),
        retry: (count, error) => count < 1 && error instanceof ApiRequestError && [0, 408, 502, 503, 504].includes(error.status),
      });
      try {
      if (!options.signal) return await execute();
      // A caller may leave while another still needs the same deduplicated read.
      // Abort only its wait; QueryClient owns the shared transport's signal.
      return await new Promise<TResponse>((resolve, reject) => {
        const signal = options.signal!;
        const abort = () => reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
        if (signal.aborted) { abort(); return; }
        signal.addEventListener("abort", abort, { once: true });
        execute().then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
      });
      } finally {
        const remaining = (readers.get(key) ?? 1) - 1;
        if (remaining) readers.set(key, remaining);
        else {
          readers.delete(key);
          if (options.signal?.aborted) await queryClient().cancelQueries({queryKey, exact: true});
        }
      }
    }
    const result = await request<TResponse, TBody>(path, options);
    if (method !== "GET") {
      if (method === "DELETE" || /\/(erase|close)$/.test(path)) queryClient().clear();
      await invalidateReads(true, relatedReads(path));
    }
    return result;
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === "resource_stale") await invalidateReads(false, relatedReads(path));
    if (error instanceof ApiRequestError && error.status === 401 && !path.startsWith("/auth/login")) {
      clearQueryScope();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("slotera-auth-expired"));
    }
    throw error;
  }
}
