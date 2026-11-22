// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { ClientPackages } from "./ClientPackages";
import type { ClientPackages as ClientPackageList } from "@/services/client-access.service";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/client/lena" }));
beforeEach(() => vi.stubGlobal("localStorage", browserStorage()));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const pack = (over: Partial<ClientPackageList["items"][number]>): ClientPackageList["items"][number] => ({
  id: "pur", packageName: "Sprint Pack", priceCents: 50000, currency: "GBP", paymentStatus: "paid", status: "active",
  refundedCents: 0, usedCount: 1, remainingCount: 1, createdAt: "2035-01-01T09:00:00Z",
  sessions: [
    { position: 0, serviceId: "svc", title: "Kick-off", bookedFor: "2035-01-05T10:00:00Z" },
    { position: 1, serviceId: "svc", title: "Sprint", bookedFor: null },
  ],
  ...over,
});

it("lets a client book a paid package's sessions and shows which are booked", () => {
  render(<I18nProvider><ClientPackages slug="lena" data={{ items: [pack({})], manualPaymentInstructions: "IBAN 123" }} /></I18nProvider>);
  expect(screen.getByText(/1 of 2 booked/)).toBeDefined();
  expect(screen.getByText("Not booked yet")).toBeDefined();
  expect(screen.queryByText("IBAN 123")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Book a session" }));
  expect(router.push).toHaveBeenCalledWith("/book/lena");
});

it("shows how to pay a pending package and doesn't offer booking yet", () => {
  render(<I18nProvider><ClientPackages slug="lena" data={{ items: [pack({ paymentStatus: "pending" })], manualPaymentInstructions: "IBAN 123" }} /></I18nProvider>);
  expect(screen.getByText("Awaiting payment")).toBeDefined();
  expect(screen.getByText(/Pay £500.00/)).toBeDefined();
  expect(screen.getByText("IBAN 123")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Book a session" })).toBeNull();
});
