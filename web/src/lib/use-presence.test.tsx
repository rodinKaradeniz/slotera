// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePresence } from "./use-presence";

function Box({ open, appear }: { open: boolean; appear?: boolean }) {
  const p = usePresence(open, 200, { appear });
  if (!p.rendered) return null;
  return <div data-testid="box" data-state={p.state} data-closing={p.closing || undefined} />;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const box = () => screen.queryByTestId("box");

it("mounts closed, opens after two frames, and stays mounted through the exit", () => {
  const { rerender } = render(<Box open={false} />);
  expect(box()).toBeNull();

  rerender(<Box open />);
  expect(box()?.dataset.state).toBe("closed");
  act(() => void vi.advanceTimersByTime(40));
  expect(box()?.dataset.state).toBe("open");

  rerender(<Box open={false} />);
  expect(box()?.dataset.state).toBe("closed");
  expect(box()?.dataset.closing).toBe("true");
  act(() => void vi.advanceTimersByTime(199));
  expect(box()).not.toBeNull();
  act(() => void vi.advanceTimersByTime(1));
  expect(box()).toBeNull();
});

it("reopening during the exit keeps the same element open", () => {
  const { rerender } = render(<Box open />);
  act(() => void vi.advanceTimersByTime(40));
  rerender(<Box open={false} />);
  act(() => void vi.advanceTimersByTime(100));
  rerender(<Box open />);
  act(() => void vi.advanceTimersByTime(300));
  expect(box()?.dataset.state).toBe("open");
  expect(box()?.dataset.closing).toBeUndefined();
});

it("unmounts at once under Reduce Motion", () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
  const { rerender } = render(<Box open />);
  act(() => void vi.advanceTimersByTime(40));
  rerender(<Box open={false} />);
  act(() => void vi.advanceTimersByTime(0));
  expect(box()).toBeNull();
});

it("starts open without an entrance when appear is off", () => {
  render(<Box open appear={false} />);
  expect(box()?.dataset.state).toBe("open");
});
