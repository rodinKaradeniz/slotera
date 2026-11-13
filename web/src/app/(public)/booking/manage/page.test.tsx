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
