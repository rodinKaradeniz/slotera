// @vitest-environment jsdom
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { DATA_CHANGED } from "@/api/query-cache";
import { getBusinessSettings } from "@/services/settings.service";
vi.mock("@/lib/env", () => ({dataSource: "api"}));
vi.mock("next/navigation", () => ({usePathname: () => "/admin/settings", useSearchParams: () => new URLSearchParams()}));
vi.mock("@/services/settings.service", () => ({getBusinessSettings: vi.fn(), getAvailabilitySettings: vi.fn(), getPaymentSettings: vi.fn(), getSettings: vi.fn()}));
vi.mock("./LocationsCard", () => ({LocationsCard: () => null}));
vi.mock("./BusinessPanel", () => ({BusinessPanel: () => {
  const [draft, setDraft] = React.useState("");
  return <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
}}));
import { SettingsView } from "./SettingsView";
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
it("retains an editor through a recoverable background refresh failure", async () => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.mocked(getBusinessSettings).mockResolvedValueOnce({name: "Test"} as Awaited<ReturnType<typeof getBusinessSettings>>).mockRejectedValueOnce(new Error("Temporary outage"));
  render(<I18nProvider><SettingsView /></I18nProvider>);
  const input = await screen.findByRole("textbox", {name: "Draft"});
  fireEvent.change(input, {target: {value: "Unsaved change"}});
  window.dispatchEvent(new Event(DATA_CHANGED));
  await screen.findByText("Temporary outage");
  expect((screen.getByRole("textbox", {name: "Draft"}) as HTMLInputElement).value).toBe("Unsaved change");
});
