// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
import { clearQueryScope, queryClient, setQueryScope } from "./query-cache";
const expires = () => new Date(Date.now() + 60_000).toISOString();
afterEach(() => { clearQueryScope(); vi.unstubAllGlobals(); });
it("deduplicates reads, reuses fresh results, and isolates verified identities", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 1 })));
  vi.stubGlobal("fetch", fetch);
  setQueryScope("workspace:a:user:1", expires());
  await Promise.all([apiRequest("/clients?limit=25"), apiRequest("/clients?limit=25")]);
  await apiRequest("/clients?limit=25");
  expect(fetch).toHaveBeenCalledTimes(1);
  setQueryScope("workspace:b:user:1", expires());
  fetch.mockResolvedValue(new Response(JSON.stringify({ value: 2 })));
  expect(await apiRequest("/clients?limit=25")).toEqual({value: 2});
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("invalidates reads after writes and never automatically retries a write", async () => {
  const fetch = vi.fn().mockImplementation(async (_url, options) => new Response(
    JSON.stringify({ value: options.method === "PATCH" ? 2 : 1 })));
  vi.stubGlobal("fetch", fetch);
  setQueryScope("workspace:a", expires());
  await apiRequest("/clients");
  await apiRequest("/clients/id", {method: "PATCH"});
  await apiRequest("/clients");
  expect(fetch).toHaveBeenCalledTimes(3);
  fetch.mockRejectedValue(new Error("offline"));
  await expect(apiRequest("/clients/id", {method: "PATCH"})).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(4);
});
it("does not cache token-protected reads or server requests before verification", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("{}")));
  await apiRequest("/clients");
  expect(queryClient().getQueryCache().getAll()).toHaveLength(0);
  setQueryScope("workspace:a", expires());
  await apiRequest("/public/bookings/manage/forms", {headers: {"X-Booking-Token": "secret"}});
  expect(queryClient().getQueryCache().getAll()).toHaveLength(0);
});
it("drops private cached data at session expiry", async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("{}")));
    setQueryScope("workspace:a", new Date(Date.now() + 100).toISOString());
    await apiRequest("/clients");
    expect(queryClient().getQueryCache().getAll()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(101);
    expect(queryClient().getQueryCache().getAll()).toHaveLength(0);
  } finally {vi.useRealTimers();}
});
it("cancels one reader without interrupting another reader of the same request", async () => {
  let finish: ((value: Response) => void) | undefined;
  const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {finish = resolve;}));
  vi.stubGlobal("fetch", fetch);
  setQueryScope("workspace:a", expires());
  const first = new AbortController();
  const leaving = apiRequest("/clients", {signal: first.signal});
  const remaining = apiRequest("/clients");
  const rejection = expect(leaving).rejects.toMatchObject({name: "AbortError"});
  first.abort();
  await rejection;
  finish!(new Response("{}"));
  await expect(remaining).resolves.toEqual({});
  expect(fetch).toHaveBeenCalledTimes(1);
});
