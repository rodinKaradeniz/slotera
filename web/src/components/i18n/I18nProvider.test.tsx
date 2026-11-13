// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider, useI18n } from "./I18nProvider";
import { writeLang } from "@/lib/i18n";
import { clearSession, writeSession } from "@/lib/session";
import { getLanguagePreference, saveLanguagePreference } from "@/services/preferences.service";
import { browserStorage } from "@/test/browser-storage";
vi.mock("@/lib/env", () => ({ dataSource: "api" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/booking/manage" }));
vi.mock("@/services/preferences.service", () => ({ getLanguagePreference: vi.fn(), saveLanguagePreference: vi.fn() }));
beforeEach(() => { vi.stubGlobal("localStorage", browserStorage()); });
afterEach(() => { cleanup(); clearSession(); writeLang("en"); vi.clearAllMocks(); vi.unstubAllGlobals(); });
function Visitor() {
  const { lang, setLang } = useI18n();
  return <button onClick={() => setLang("tr")}>{lang}</button>;
}
it("lets a public visitor change language despite a stale operator snapshot", async () => {
  writeSession({ role: "operator_admin", operator: { id: "stale-demo", title: "", firstNames: "Test", lastName: "User", name: "Test User", email: "test@example.com", workspaceName: "Test", avatarInitials: "TU" } });
  render(<I18nProvider><Visitor /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "en" }));
  expect(await screen.findByRole("button", { name: "tr" })).toBeDefined();
  expect(getLanguagePreference).not.toHaveBeenCalled();
  expect(saveLanguagePreference).not.toHaveBeenCalled();
});
