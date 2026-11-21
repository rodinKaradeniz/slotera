// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { browserStorage } from "@/test/browser-storage";
import { listActivePackages } from "@/services/packages.service";
import { listClientPackagePurchases, markPackagePaid, recordPackageSale, voidPackagePurchase } from "@/services/package-purchases.service";
import { ClientPackagesCard } from "./ClientPackagesCard";
import type { PackagePurchase } from "@/types/package-purchase";
vi.mock("@/services/packages.service", () => ({ listActivePackages: vi.fn() }));
vi.mock("@/services/package-purchases.service", () => ({
  listClientPackagePurchases: vi.fn(), markPackagePaid: vi.fn(), recordPackageSale: vi.fn(), voidPackagePurchase: vi.fn(),
}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const sale: PackagePurchase = {
  id: "pur", version: 3, clientId: "cli", packageId: "pkg", packageName: "Sprint Pack", priceCents: 50000, currency: "GBP",
  paymentStatus: "pending", status: "active", usedCount: 1, remainingCount: 1, createdAtISO: "2035-01-01T09:00:00Z",
  items: [
    { position: 0, serviceId: "svc", title: "Kick-off", booking: { id: "bkg", status: "confirmed", startISO: "2035-01-05T10:00:00Z" } },
    { position: 1, serviceId: "svc", title: "Sprint", booking: null },
  ],
};

beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  vi.mocked(listClientPackagePurchases).mockResolvedValue([sale]);
  vi.mocked(listActivePackages).mockResolvedValue([{ id: "pkg", name: "Sprint Pack", priceCents: 50000, currency: "GBP", items: [{}, {}] } as never]);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const mount = (readOnly = false) => render(<I18nProvider><ToastProvider><ClientPackagesCard clientId="cli" readOnly={readOnly} /></ToastProvider></I18nProvider>);

it("shows which sessions are booked and records the payment with the sale's version", async () => {
  vi.mocked(markPackagePaid).mockResolvedValue({ ...sale, paymentStatus: "paid" });
  mount();
  expect(await screen.findByText("Sprint Pack")).toBeDefined();
  expect(screen.getByText(/1 of 2 booked/)).toBeDefined();
  expect(screen.getByText("Awaiting payment")).toBeDefined();
  expect(screen.getByRole("link").getAttribute("href")).toBe("/admin/bookings/bkg");
  expect(screen.getByText("Not booked yet")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Mark payment received" }));
  await waitFor(() => expect(markPackagePaid).toHaveBeenCalledWith("pur", 3));
  await waitFor(() => expect(listClientPackagePurchases).toHaveBeenCalledTimes(2));
});

it("voids only after confirmation", async () => {
  vi.mocked(voidPackagePurchase).mockResolvedValue({ ...sale, status: "voided", remainingCount: 0 });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Void package" }));
  const dialog = screen.getByRole("dialog", { name: "Void Sprint Pack?" });
  expect(voidPackagePurchase).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Void package" }));
  await waitFor(() => expect(voidPackagePurchase).toHaveBeenCalledWith("pur", 3));
});

it("records a sale once per opened dialog, keeping the key across a retry", async () => {
  vi.mocked(listClientPackagePurchases).mockResolvedValue([]);
  vi.mocked(recordPackageSale).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(sale);
  mount();
  expect(await screen.findByText(/No packages sold to this client yet/)).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Record sale" }));
  const dialog = await screen.findByRole("dialog", { name: "Record a package sale" });
  await within(dialog).findByRole("option", { name: "Sprint Pack · £500.00" });
  fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "pkg" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Payment already received" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Record sale" }));
  expect(await screen.findByText("Offline")).toBeDefined();
  fireEvent.click(within(dialog).getByRole("button", { name: "Record sale" }));
  await waitFor(() => expect(recordPackageSale).toHaveBeenCalledTimes(2));
  const [first, second] = vi.mocked(recordPackageSale).mock.calls;
  expect(first).toEqual(["cli", { packageId: "pkg", paymentReceived: true, notes: "" }, expect.any(String)]);
  expect(second[2]).toBe(first[2]);
});

it("is read-only for an erased client", async () => {
  mount(true);
  await screen.findByText("Sprint Pack");
  expect(screen.queryByRole("button", { name: "Record sale" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Void package" })).toBeNull();
});
