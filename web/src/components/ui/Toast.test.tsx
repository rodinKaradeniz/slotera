// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { ToastProvider, useToast } from "./Toast";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", browserStorage());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Trigger({ durationMs }: { durationMs?: number }) {
  const { toast } = useToast();
  const n = React.useRef(0);
  return <button onClick={() => toast.success(`Saved ${++n.current}`, { durationMs })}>Add</button>;
}

const shells = () => Array.from(document.querySelectorAll(".toast-shell")) as HTMLElement[];

it("keeps at most three toasts, newest on top, and lets the oldest leave", () => {
  render(<I18nProvider><ToastProvider><Trigger durationMs={0} /></ToastProvider></I18nProvider>);
  for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(shells()[0].textContent).toContain("Saved 4");
  expect(shells().filter((s) => s.dataset.state === "open")).toHaveLength(3);
  expect(shells().at(-1)?.dataset.state).toBe("closed");
  act(() => void vi.advanceTimersByTime(250));
  expect(shells()).toHaveLength(3);
  expect(screen.queryByText("Saved 1")).toBeNull();
});

it("pauses auto-dismiss while the pointer is on the stack", () => {
  render(<I18nProvider><ToastProvider><Trigger durationMs={1000} /></ToastProvider></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  const region = screen.getByRole("region");
  act(() => void vi.advanceTimersByTime(600));
  fireEvent.pointerEnter(region);
  act(() => void vi.advanceTimersByTime(5000));
  expect(shells()[0].dataset.state).toBe("open");
  fireEvent.pointerLeave(region);
  act(() => void vi.advanceTimersByTime(399));
  expect(shells()[0].dataset.state).toBe("open");
  act(() => void vi.advanceTimersByTime(1));
  expect(shells()[0].dataset.state).toBe("closed");
});
