// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { BookingEmails } from "./BookingEmails";
import { listBookingEmails, sendBookingDetails } from "@/services/bookings.service";
import { browserStorage } from "@/test/browser-storage";
import type { Booking } from "@/types/booking";
vi.mock("@/services/bookings.service", () => ({ listBookingEmails: vi.fn(), sendBookingDetails: vi.fn() }));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: ({ open, title, description, onConfirm, confirmLabel }: { open: boolean; title: string; description: React.ReactNode; onConfirm: () => void; confirmLabel: string }) => open ? <div role="dialog"><h2>{title}</h2>{description}<button onClick={onConfirm}>{confirmLabel}</button></div> : null }));
const booking: Booking = { id: "b", sessionId: "s", clientId: "c", status: "pending", paymentStatus: "pending", amountCents: 100, currency: "GBP", createdAtISO: "2030-01-01T00:00:00Z", emailContact: "original@example.com" };
beforeEach(() => { vi.stubGlobal("localStorage", browserStorage()); vi.mocked(listBookingEmails).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("reviews a correction, preserves it after a conflict, and reuses the request key on retry", async () => {
  vi.mocked(sendBookingDetails).mockRejectedValueOnce(new Error("An email is being sent.")).mockResolvedValueOnce({ ...booking, emailContact: "fixed@example.com" });
  const updated = vi.fn();
  render(<I18nProvider><ToastProvider><BookingEmails booking={booking} onUpdated={updated} /></ToastProvider></I18nProvider>);
  await screen.findByText("No booking emails yet.");
  fireEvent.click(screen.getByRole("button", { name: "Send booking details" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Destination email/ }), { target: { value: "fixed@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Correct address and send" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "An email is being sent.");
  expect(updated).not.toHaveBeenCalled();
  const key = vi.mocked(sendBookingDetails).mock.calls[0][2];
  fireEvent.click(screen.getByRole("button", { name: "Correct address and send" }));
  await screen.findByText("Booking details queued.");
  expect(sendBookingDetails).toHaveBeenLastCalledWith("b", "fixed@example.com", key);
  expect(updated).toHaveBeenCalledWith(expect.objectContaining({ emailContact: "fixed@example.com" }));
});
it("does not offer sends after erasure", async () => {
  render(<I18nProvider><ToastProvider><BookingEmails booking={{ ...booking, emailContact: "" }} onUpdated={vi.fn()} /></ToastProvider></I18nProvider>);
  expect(screen.getByRole("button", { name: "Send booking details" }).hasAttribute("disabled")).toBe(true);
});
