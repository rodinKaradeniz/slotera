// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { browserStorage } from "@/test/browser-storage";
import {
  publishClientLifecycle,
  subscribeClientLifecycle,
} from "./client-lifecycle";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("broadcasts only lifecycle markers and unsubscribes", () => {
  const storage = browserStorage();
  const set = vi.spyOn(storage, "setItem");
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("BroadcastChannel", undefined);
  const callback = vi.fn();
  const stop = subscribeClientLifecycle(callback);
  publishClientLifecycle();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(set.mock.calls[0][0]).toBe("slotera.client.lifecycle");
  expect(set.mock.calls[0][1]).toMatch(/^[a-f0-9-]{36}$/);
  expect(storage.length).toBe(0);
  stop();
  publishClientLifecycle();
  expect(callback).toHaveBeenCalledTimes(1);
});
it("still invalidates local views when browser storage is disabled", () => {
  vi.stubGlobal("localStorage", {
    setItem() {
      throw new Error("Disabled");
    },
  });
  vi.stubGlobal("BroadcastChannel", undefined);
  const callback = vi.fn();
  const stop = subscribeClientLifecycle(callback);
  expect(() => publishClientLifecycle()).not.toThrow();
  expect(callback).toHaveBeenCalledOnce();
  stop();
});
