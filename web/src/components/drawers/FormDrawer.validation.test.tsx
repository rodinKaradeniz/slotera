// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { browserStorage } from "@/test/browser-storage";
import { FormDrawer } from "./FormDrawer";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/services/forms.service", () => ({ getForm: vi.fn(), createForm: create }));
vi.mock("@/services/services.service", () => ({ searchServiceOptions: async () => [] }));
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  create.mockReset().mockResolvedValue({ id: "saved", name: "Prep" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows missing names and question labels inline, focuses the first error, then saves corrected values", async () => {
  render(<I18nProvider><ToastProvider><FormDrawer open onClose={() => undefined} /></ToastProvider></I18nProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  const name = screen.getByRole("textbox", { name: /^Form name/ });
  expect(name.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText("Enter a form name.")).toBeDefined();
  expect(document.activeElement).toBe(name);
  fireEvent.change(name, { target: { value: "Prep" } });
  fireEvent.click(screen.getByRole("button", { name: "Add field" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const label = screen.getByRole("textbox", { name: /^Label/ });
  expect(screen.getByText("Enter a question label.")).toBeDefined();
  expect(document.activeElement).toBe(label);
  expect(create).not.toHaveBeenCalled();
  fireEvent.change(label, { target: { value: "What should we discuss?" } });
  expect(label.getAttribute("aria-invalid")).not.toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(create).toHaveBeenCalledTimes(1);
});
it("shows a choice error next to the options when every row is blank", async () => {
  render(<I18nProvider><ToastProvider><FormDrawer open onClose={() => undefined} /></ToastProvider></I18nProvider>);
  fireEvent.change(await screen.findByRole("textbox", { name: /^Form name/ }), { target: { value: "Prep" } });
  fireEvent.click(screen.getByRole("button", { name: "Add field" }));
  fireEvent.change(screen.getByRole("textbox", { name: /^Label/ }), { target: { value: "Topic" } });
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "multi_select" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByText("Add at least one option.")).toBeDefined();
  expect(create).not.toHaveBeenCalled();
});
