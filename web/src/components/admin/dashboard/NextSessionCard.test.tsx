// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { writeLang, type Lang } from "@/lib/i18n";
import { browserStorage } from "@/test/browser-storage";
import { NextSessionCard } from "./NextSessionCard";

vi.mock("@/components/drawers/DrawersProvider", () => ({ useDrawers: () => ({ openBookingDrawer: vi.fn() }) }));
beforeEach(() => { vi.stubGlobal("localStorage", browserStorage()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([
  ["en", "Ready for your next session", "Open calendar"],
  ["tr", "Bir sonraki seansınıza hazırsınız", "Takvimi aç"],
  ["de", "Bereit für Ihre nächste Sitzung", "Kalender öffnen"],
] as [Lang, string, string][])("keeps an actionable empty schedule in %s", async (lang, title, action) => {
  writeLang(lang);
  render(<I18nProvider><NextSessionCard schedule={[]} /></I18nProvider>);
  expect(await screen.findByRole("heading", { name: title })).toBeDefined();
  expect(screen.getByRole("link", { name: action }).getAttribute("href")).toBe("/admin/calendar");
});
