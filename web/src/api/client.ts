import { apiBaseUrl, csrfCookieName } from "@/lib/env";
import { ApiRequestError } from "@/services/_errors";
import type { components } from "@/api/generated/schema";

type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions<TBody> = {
  method?: HttpMethod;
  body?: TBody;
  csrf?: boolean;
  idempotencyKey?: string;
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

export async function apiRequest<TResponse, TBody = never>(
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
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, `${apiBaseUrl.replace(/\/$/, "")}/`), {
      method,
      headers,
      credentials: "include",
      cache: "no-store",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiRequestError(
      0,
      "network_error",
      "Could not reach the Slotera API.",
    );
  }

  if (response.status === 204) return undefined as TResponse;

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
