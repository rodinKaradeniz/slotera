// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useLoad } from "./use-load";

afterEach(cleanup);

describe("useLoad", () => {
  it("loads, then reloads on request and keeps the last data meanwhile", async () => {
    let calls = 0;
    const load = async () => ++calls;
    const { result } = renderHook(() => useLoad(load));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(1));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it("reports a failed load and recovers on retry", async () => {
    let fail = true;
    const load = async () => {
      if (fail) throw new Error("API is down");
      return "ok";
    };
    const { result } = renderHook(() => useLoad(load));

    await waitFor(() => expect(result.current.error).toBe("API is down"));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();

    fail = false;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe("ok"));
    expect(result.current.error).toBeNull();
  });

  it("loads again when the memoised loader changes", async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useLoad(React.useCallback(() => Promise.resolve(`item-${id}`), [id])),
      { initialProps: { id: 1 } },
    );
    await waitFor(() => expect(result.current.data).toBe("item-1"));
    expect(result.current.loading).toBe(false);

    rerender({ id: 2 });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe("item-2"));
    expect(result.current.loading).toBe(false);
  });
});
