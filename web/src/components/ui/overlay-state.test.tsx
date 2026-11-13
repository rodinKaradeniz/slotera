// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { writeLang, type Lang } from "@/lib/i18n";
import { browserStorage } from "@/test/browser-storage";
import { DrawerShell } from "./DrawerShell";
import { ToastProvider, useToast } from "./Toast";

beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Feedback() {
  const { toast } = useToast();
  return <button onClick={() => toast.success("Saved", { durationMs: 0 })}>Save</button>;
}

it.each(["en", "tr", "de"] as Lang[])("keeps drawer and toast CSS states untranslated in %s", async (lang) => {
  writeLang(lang);
  const { container } = render(<I18nProvider><ToastProvider>
    <DrawerShell open onClose={() => undefined} title="Create a form"><p>Form editor</p></DrawerShell>
    <Feedback />
  </ToastProvider></I18nProvider>);
  await waitFor(() => expect(document.querySelector(".drawer-panel")?.getAttribute("data-state")).toBe("open"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const saved = await screen.findByText("Saved");
  expect(saved.closest("[data-state]")?.getAttribute("data-state")).toBe("open");
  expect(container).toBeDefined();
});

it("closing a nested confirmation keeps the drawer open and the page locked", async () => {
  const { Modal } = await import("./Modal");
  function Nested() {
    const [confirm, setConfirm] = React.useState(false);
    const [open, setOpen] = React.useState(true);
    return <I18nProvider><DrawerShell open={open} onClose={() => setOpen(false)} title="Editor">
      <button onClick={() => setConfirm(true)}>Delete</button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Confirm deletion" />
    </DrawerShell></I18nProvider>;
  }
  render(<Nested />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(2);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(document.body.classList.contains("scroll-locked")).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(document.body.classList.contains("scroll-locked")).toBe(false);
});
