// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePagedHistory } from "./use-paged-history";
afterEach(cleanup);
it("deduplicates concurrent history loads and prepends older rows", async () => {
  const load = vi.fn(async (offset: number) => ({
    items: [{ id: offset ? "older" : "newer" }],
    total: 2,
    limit: 1,
    offset,
  }));
  const { result } = renderHook(() => usePagedHistory("thread", load, true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await Promise.all([result.current.more(), result.current.more()]);
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.items.map((row) => row.id)).toEqual(["older", "newer"]);
  expect(result.current.hasMore).toBe(false);
});
it("aborts obsolete scopes and never shows another conversation after an error", async () => {
  const loadA = vi.fn(async (_offset: number, _signal: AbortSignal) => ({
    items: [{ id: "private-a" }],
    total: 1,
    limit: 25,
    offset: 0,
  }));
  const loadB = vi.fn(async () => {
    throw new Error("Offline");
  });
  const { result, rerender } = renderHook(
    ({ scope }) => usePagedHistory(scope, scope === "a" ? loadA : loadB),
    { initialProps: { scope: "a" } },
  );
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  rerender({ scope: "b" });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.items).toEqual([]);
  expect(loadA.mock.calls[0][1].aborted).toBe(true);
});
