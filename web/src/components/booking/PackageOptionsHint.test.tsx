// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { listPackagesForService } from "@/services/packages.service";
import { requestPackage } from "@/services/package-purchases.service";
import { getSettings } from "@/services/settings.service";
import { PackageOptionsHint } from "./PackageOptionsHint";
vi.mock("@/services/packages.service", () => ({ listPackagesForService: vi.fn() }));
vi.mock("@/services/package-purchases.service", () => ({ requestPackage: vi.fn() }));
vi.mock("@/services/settings.service", () => ({ getSettings: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const offer = { id: "pkg", name: "Sprint Pack", description: "", priceCents: 50000, currency: "GBP" as const, featured: false,
  items: [{ serviceId: "svc", order: 0 }, { serviceId: "svc", order: 1 }] };
const settings = (manual: boolean) => ({ business: { displayName: "Lena" },
  payments: { manualPaymentEnabled: manual, bookingTerms: { enabled: false, content: "" } } });

beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.mocked(listPackagesForService).mockResolvedValue([offer] as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("lets a visitor request a package and shows how to pay", async () => {
  vi.mocked(getSettings).mockResolvedValue(settings(true) as never);
  vi.mocked(requestPackage).mockResolvedValue({ id: "pur", packageName: "Sprint Pack", priceCents: 50000, currency: "GBP",
    paymentStatus: "pending", sessionCount: 2, manualPaymentInstructions: "IBAN DE00 1234" });
  render(<I18nProvider><PackageOptionsHint serviceId="svc" /></I18nProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "View package options" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Buy" }));
  const submit = within(dialog).getByRole("button", { name: "Request package" });
  expect(submit.hasAttribute("disabled")).toBe(true);
  fireEvent.change(within(dialog).getByRole("textbox", { name: /First name/ }), { target: { value: "Mira" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: /Last name/ }), { target: { value: "Neu" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: /Email/ }), { target: { value: "mira@example.com" } });
  fireEvent.click(within(dialog).getByRole("checkbox"));
  fireEvent.click(submit);
  expect(await within(dialog).findByText("IBAN DE00 1234")).toBeDefined();
  expect(requestPackage).toHaveBeenCalledWith("pkg", expect.objectContaining({ email: "mira@example.com" }), expect.any(String));
});

it("only lists the packages when the consultant takes no manual payments", async () => {
  vi.mocked(getSettings).mockResolvedValue(settings(false) as never);
  render(<I18nProvider><PackageOptionsHint serviceId="svc" /></I18nProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "View package options" }));
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Buy" })).toBeNull();
});
