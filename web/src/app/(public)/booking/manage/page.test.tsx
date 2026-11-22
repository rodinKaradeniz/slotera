// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ApiRequestError } from "@/services/_errors";
import { getManagedBooking } from "@/services/public-booking.service";
import { browserStorage } from "@/test/browser-storage";
import ManageBookingPage from "./page";

const router = { replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/booking/manage" }));
vi.mock("@/lib/env", () => ({ dataSource: "api" }));
vi.mock("@/services/public-booking.service", () => ({ getManagedBooking: vi.fn(), setPublicWorkspaceSlug: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  window.history.replaceState(null, "", "/booking/manage#local-test-booking-token");
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("offers retry for throttling and only marks a 404 as an invalid link", async () => {
  vi.mocked(getManagedBooking)
    .mockRejectedValueOnce(new ApiRequestError(429, "rate_limit_exceeded", "Please try again later"))
    .mockRejectedValueOnce(new ApiRequestError(404, "booking_link_invalid", "Invalid link"));
  render(<I18nProvider><ToastProvider><ManageBookingPage /></ToastProvider></I18nProvider>);
  expect(await screen.findByText("Please try again later")).toBeDefined();
  expect(screen.queryByText("This link doesn't work.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("This link doesn't work.")).toBeDefined();
});

it("shows a package session as covered and lists a refund", async () => {
  vi.mocked(getManagedBooking).mockResolvedValue({
    reference: "SLT-PKG", status: "confirmed", paymentStatus: "paid", paymentMethod: "package", approvalStatus: "not_required",
    pendingReasons: [], amountCents: 0, refundedCents: 0, currency: "GBP", paymentDueAt: null, manualPaymentInstructions: "",
    serviceId: "svc", serviceName: "Strategy Session", cancellationRule: "", providerName: "Lena", providerEmail: "lena@example.com",
    providerPhone: null, workspaceSlug: "lena", timezone: "Europe/London", sessionStartAt: "2035-01-05T10:00:00Z",
    sessionEndAt: "2035-01-05T11:00:00Z", sessionLocationType: "online", sessionLocation: "Zoom", sessionAddress: null,
    changeDeadline: "2035-01-04T10:00:00Z", canCancel: false, canReschedule: false, meetingUrl: null, rescheduled: false,
    showPlatformBranding: false,
  } as never);
  render(<I18nProvider><ToastProvider><ManageBookingPage /></ToastProvider></I18nProvider>);
  expect(await screen.findByText("Covered by your package")).toBeDefined();
  expect(screen.queryByText("£0.00")).toBeNull();
});
