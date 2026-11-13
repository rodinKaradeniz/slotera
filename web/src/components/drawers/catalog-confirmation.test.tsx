// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { browserStorage } from "@/test/browser-storage";
const { update, deactivate, activate } = vi.hoisted(() => ({ update: vi.fn(), deactivate: vi.fn(), activate: vi.fn() }));
vi.mock("@/services/services.service", () => ({ updateService: update, deactivateService: deactivate, activateService: activate, createService: vi.fn(), removeService: vi.fn() }));
vi.mock("@/services/forms.service", () => ({ updateForm: update, deactivateForm: deactivate, activateForm: activate, createForm: vi.fn(), removeForm: vi.fn() }));
vi.mock("@/services/packages.service", () => ({ updatePackage: update, deactivatePackage: deactivate, activatePackage: activate, createPackage: vi.fn(), removePackage: vi.fn() }));
vi.mock("@/lib/use-workspace-currency", () => ({ useWorkspaceCurrency: () => "GBP" }));
function Draft({ value, onChange }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  return <button onClick={() => onChange({ ...value, active: false, status: "inactive" })}>Set draft inactive</button>;
}
vi.mock("@/components/shared/forms/ServiceForm", () => ({ ServiceForm: Draft }));
vi.mock("@/components/shared/forms/FormTemplateForm", () => ({ FormTemplateForm: Draft }));
vi.mock("@/components/shared/forms/PackageForm", () => ({ PackageForm: Draft }));
import { ServiceDrawer } from "./ServiceDrawer";
import { FormDrawer } from "./FormDrawer";
import { PackageDrawer } from "./PackageDrawer";
import type { Service } from "@/types/service";
import type { FormTemplate } from "@/types/form";
import type { ServicePackage } from "@/types/package";
const initial = {
  id: "item", name: "Test offer", active: true, status: "active", priceCents: 100,
  description: "", durationMin: 30, currency: "GBP", capacity: 1,
  locationType: "online", location: "Online", bookingMode: "open", confirmationPolicy: "automatic",
  cancellationRule: "", createdAtISO: "2026-01-01", updatedAtISO: "2026-01-01",
  fields: [], attachedServiceIds: [], requiredBeforePayment: false, items: [],
} satisfies Service & FormTemplate & ServicePackage;
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  update.mockReset().mockResolvedValue({ ...initial, active: false, status: "inactive" });
  deactivate.mockReset().mockResolvedValue({ ...initial, active: false, status: "inactive" });
  activate.mockReset().mockResolvedValue(initial);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const drawers = [
  ["service", () => <ServiceDrawer open initial={initial as Service} onClose={() => undefined} />],
  ["form", () => <FormDrawer open initial={initial as FormTemplate} onClose={() => undefined} />],
  ["package", () => <PackageDrawer open initial={initial as ServicePackage} onClose={() => undefined} />],
] as const;
it.each(drawers)("confirms %s deactivation, supports cancellation and reactivation", async (_, drawer) => {
  render(<I18nProvider><ToastProvider>{drawer()}</ToastProvider></I18nProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
  expect(deactivate).not.toHaveBeenCalled();
  let confirm = screen.getByRole("dialog", { name: "Deactivate Test offer?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
  expect(deactivate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
  confirm = screen.getByRole("dialog", { name: "Deactivate Test offer?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Deactivate" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Activate" })).toBeDefined());
  expect(deactivate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Activate" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Deactivate" })).toBeDefined());
  expect(activate).toHaveBeenCalledTimes(1);
});
it.each(drawers)("also confirms %s deactivation through the editor Save button", async (_, drawer) => {
  render(<I18nProvider><ToastProvider>{drawer()}</ToastProvider></I18nProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Set draft inactive" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(update).not.toHaveBeenCalled();
  const confirm = screen.getByRole("dialog", { name: "Deactivate Test offer?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Deactivate" }));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
});
