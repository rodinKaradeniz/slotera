// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { PageScrollbar, ScrollArea } from "./ScrollArea";

beforeEach(() => vi.stubGlobal("localStorage", browserStorage()));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function area() {
  render(<I18nProvider><ScrollArea><p>Content</p></ScrollArea></I18nProvider>);
  const viewport = document.querySelector<HTMLElement>(".overlay-scroll-viewport")!;
  Object.defineProperties(viewport, { clientHeight: { configurable: true, value: 200 }, scrollHeight: { configurable: true, value: 1000 } });
  Object.defineProperty(viewport, "scrollTo", { configurable: true, value: vi.fn(({ top }: ScrollToOptions) => {
    viewport.scrollTop = top ?? 0; viewport.dispatchEvent(new Event("scroll"));
  }) });
  fireEvent.resize(window);
  return viewport;
}
it("scrolls with keyboard and wheel, reports its target and clamps to the content bounds", () => {
  const viewport = area();
  const bar = screen.getByRole("scrollbar", { name: "Scroll content" });
  expect(bar.getAttribute("aria-controls")).toBe(viewport.id);
  fireEvent.keyDown(bar, { key: "PageDown" });
  expect(viewport.scrollTop).toBe(200);
  fireEvent.keyDown(bar, { key: "End" });
  expect(viewport.scrollTop).toBe(800);
  expect(bar.getAttribute("aria-valuenow")).toBe("800");
  fireEvent.wheel(bar, { deltaY: 100 });
  expect(viewport.scrollTop).toBe(800);
  fireEvent.keyDown(bar, { key: "Home" });
  expect(viewport.scrollTop).toBe(0);
  fireEvent.wheel(bar, { deltaY: 40 });
  expect(viewport.scrollTop).toBe(40);
});
it("tracks pointer dragging and removes the control when content no longer overflows", () => {
  const viewport = area();
  const bar = screen.getByRole("scrollbar");
  vi.stubGlobal("PointerEvent", MouseEvent);
  bar.setPointerCapture = vi.fn();
  fireEvent.pointerDown(bar, { button: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(bar, { clientY: 80, pointerId: 1 });
  expect(viewport.scrollTop).toBe(400);
  fireEvent.pointerUp(bar);
  fireEvent.pointerMove(bar, { clientY: 120 });
  expect(viewport.scrollTop).toBe(400);
  Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 200 });
  fireEvent.resize(window);
  expect(screen.queryByRole("scrollbar")).toBeNull();
});
it("hides the page thumb while a dialog locks scrolling and restores it afterwards", async () => {
  Object.defineProperty(document, "scrollingElement", { configurable: true, value: document.documentElement });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2000 });
  render(<I18nProvider><PageScrollbar /></I18nProvider>);
  expect(screen.getByRole("scrollbar", { name: "Scroll page" })).toBeDefined();
  await act(async () => { document.body.classList.add("scroll-locked"); });
  expect(screen.queryByRole("scrollbar")).toBeNull();
  await act(async () => { document.body.classList.remove("scroll-locked"); });
  expect(screen.getByRole("scrollbar")).toBeDefined();
});

it("keeps the page scrollbar out of layout and hides its native track even before stylesheet updates load", () => {
  Object.defineProperty(document, "scrollingElement", { configurable: true, value: document.documentElement });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2000 });
  document.documentElement.style.scrollbarWidth = "thin";
  document.documentElement.style.scrollbarGutter = "stable";
  const { unmount } = render(<I18nProvider><PageScrollbar /></I18nProvider>);
  expect(getComputedStyle(screen.getByRole("scrollbar")).position).toBe("fixed");
  expect(getComputedStyle(document.documentElement).scrollbarWidth).toBe("none");
  expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe("auto");
  unmount();
  expect(document.documentElement.style.scrollbarWidth).toBe("thin");
  expect(document.documentElement.style.scrollbarGutter).toBe("stable");
  document.documentElement.style.scrollbarWidth = "";
  document.documentElement.style.scrollbarGutter = "";
});
