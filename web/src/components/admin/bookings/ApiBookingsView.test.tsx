// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { browserStorage } from "@/test/browser-storage";
import { listBookingSummaries } from "@/services/bookings.service";
import { ApiBookingsView } from "./ApiBookingsView";
const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), drawer: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/bookings", useRouter: () => mocks, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/drawers/DrawersProvider", () => ({ useDrawers: () => ({ openBookingDrawer: mocks.drawer }) }));
vi.mock("@/lib/use-workspace-timezone", () => ({ useWorkspaceTimezone: () => "Europe/London" }));
vi.mock("@/services/services.service", () => ({ searchServiceOptions: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/bookings.service", () => ({ listBookingSummaries: vi.fn(), exportBookingSummaries: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.mocked(listBookingSummaries).mockImplementation(async ({ status, offset }) => ({
    items: [{ id: "booking-1", clientId: "client", sessionId: "session", serviceId: "service", reference: "REF",
      clientName: "Ada", clientCompany: null, serviceName: "Strategy", startAt: "2030-01-01T12:00:00Z",
      status: status ?? "pending", paymentStatus: "pending", amountCents: 100, currency: "GBP", createdAt: "2030-01-01T00:00:00Z" }],
    total: 26, offset: offset ?? 0, limit: 25, statusCounts: { pending: 26, confirmed: 1 }, statusPreviews: {}, pendingPaymentCount: 26,
  }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("loads only opened groups, pages on the server, and opens booking details", async () => {
  render(<I18nProvider><ToastProvider><ApiBookingsView /></ToastProvider></I18nProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
  expect(mocks.push).toHaveBeenCalledWith("/admin/bookings/booking-1");
  expect(listBookingSummaries).toHaveBeenCalledTimes(1);
  expect(vi.mocked(listBookingSummaries).mock.calls[0][0].status).toBe("pending");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(vi.mocked(listBookingSummaries).mock.calls.at(-1)?.[0].offset).toBe(25));
  fireEvent.click(screen.getByRole("button", { name: /Confirmed · 1/ }));
  await waitFor(() => expect(vi.mocked(listBookingSummaries).mock.calls.at(-1)?.[0].status).toBe("confirmed"));
});
