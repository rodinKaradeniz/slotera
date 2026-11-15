// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { writeLang, type Lang } from "@/lib/i18n";
import { browserStorage } from "@/test/browser-storage";
import { ToastProvider } from "@/components/ui/Toast";
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
  render(<I18nProvider><ToastProvider><NextSessionCard schedule={[]} /></ToastProvider></I18nProvider>);
  expect(await screen.findByRole("heading", { name: title })).toBeDefined();
  expect(screen.getByRole("link", { name: action }).getAttribute("href")).toBe("/admin/calendar");
});

it.each([
  ["en", "29 Mar"], ["tr", "29 Mar"], ["de", "29. März"],
] as [Lang, string][])("includes the upcoming session date in %s", async (lang, date) => {
  writeLang(lang);
  render(<I18nProvider><ToastProvider><NextSessionCard schedule={[]} item={{id: "future", startISO: "2026-03-29T08:00:00Z", timezone: "Europe/Berlin", time: "10:00", end: "10:30", client: "Synthetic client", service: "Consultation", duration: "30 min", status: "next"}} /></ToastProvider></I18nProvider>);
  expect(await screen.findByText(new RegExp(date.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeDefined();
});
