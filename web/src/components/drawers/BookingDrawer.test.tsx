// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { translate } from "@/lib/i18n";
import { browserStorage } from "@/test/browser-storage";
import { cancelBooking, updateBooking } from "@/services/bookings.service";
import { listClients } from "@/services/clients.service";
import { listSessions } from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { BookingDrawer } from "./BookingDrawer";
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
vi.mock("@/services/bookings.service", () => ({ updateBooking: vi.fn(), cancelBooking: vi.fn() }));
vi.mock("@/services/clients.service", () => ({ listClients: vi.fn() }));
vi.mock("@/services/sessions.service", () => ({ listSessions: vi.fn() }));
vi.mock("@/services/services.service", () => ({ listServices: vi.fn() }));
vi.mock("@/lib/use-workspace-timezone", () => ({ useWorkspaceTimezone: () => "UTC" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/components/ui/DrawerShell", () => ({ DrawerShell: ({ children, footer, open }: { children: React.ReactNode; footer: React.ReactNode; open: boolean }) => open ? <div>{children}{footer}</div> : null }));

const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
const labelled = (key: Parameters<typeof translate>[1]) => new RegExp(t(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const booking: Booking = {
  id: "bkg", sessionId: "ses", clientId: "cli", status: "pending", paymentStatus: "pending",
  amountCents: 9000, currency: "EUR", createdAtISO: "2035-01-01T09:00:00Z", notes: "",
};
const client = { id: "cli", name: "Ada Client", email: "ada@example.com" } as Client;

beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  vi.mocked(listClients).mockResolvedValue([client]);
  vi.mocked(listSessions).mockResolvedValue([{ id: "ses", serviceId: "svc", startISO: "2035-01-02T10:00:00Z", endISO: "2035-01-02T11:00:00Z",
    capacity: 1, bookedCount: 1, status: "scheduled", locationType: "online", location: "Call", recurring: "one-off" }]);
  vi.mocked(listServices).mockResolvedValue([{ id: "svc", name: "Deep dive" } as never]);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function mount(props: Partial<React.ComponentProps<typeof BookingDrawer>> = {}) {
  return render(<I18nProvider><ToastProvider><BookingDrawer open initial={booking} onClose={vi.fn()} {...props} /></ToastProvider></I18nProvider>);
}

it("saves the edited status, payment and note with the booking's currency", async () => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const saved = { ...booking, status: "confirmed" as const, paymentStatus: "paid" as const, notes: "Bring the brief" };
  vi.mocked(updateBooking).mockResolvedValue(saved);
  mount({ onSaved, onClose });
  await screen.findByRole("option", { name: "Ada Client · ada@example.com" });
  expect(screen.getByRole("option", { name: /^Deep dive · / })).toBeDefined();
  fireEvent.change(screen.getByRole("combobox", { name: labelled("ui.booking.status") }), { target: { value: "confirmed" } });
  fireEvent.change(screen.getByRole("combobox", { name: labelled("ui.payment.status") }), { target: { value: "paid" } });
  fireEvent.change(screen.getByRole("textbox", { name: labelled("ui.booking.note") }), { target: { value: "Bring the brief" } });
  fireEvent.click(screen.getByRole("button", { name: t("ui.save.changes") }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  expect(updateBooking).toHaveBeenCalledWith("bkg", { clientId: "cli", sessionId: "ses", status: "confirmed",
    paymentStatus: "paid", amountCents: 9000, currency: "EUR", notes: "Bring the brief" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("keeps the drawer open with the draft when saving fails", async () => {
  const onClose = vi.fn();
  vi.mocked(updateBooking).mockRejectedValue(new Error("Session is full"));
  mount({ onClose });
  await screen.findByRole("option", { name: "Ada Client · ada@example.com" });
  fireEvent.change(screen.getByRole("textbox", { name: labelled("ui.booking.note") }), { target: { value: "Draft" } });
  fireEvent.click(screen.getByRole("button", { name: t("ui.save.changes") }));
  expect(await screen.findByText("Session is full")).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox", { name: labelled("ui.booking.note") }) as HTMLTextAreaElement).value).toBe("Draft");
});

it("cancels only after confirmation, and keeping the booking changes nothing", async () => {
  const onCancelled = vi.fn();
  const cancelled = { ...booking, status: "cancelled" as const };
  vi.mocked(cancelBooking).mockResolvedValue(cancelled);
  mount({ onCancelled });
  fireEvent.click(screen.getByRole("button", { name: t("ui.cancel.booking") }));
  let confirm = await screen.findByRole("dialog", { name: t("ui.cancel.this.booking") });
  fireEvent.click(within(confirm).getByRole("button", { name: t("ui.keep.booking") }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: t("ui.cancel.this.booking") })).toBeNull());
  expect(cancelBooking).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: t("ui.cancel.booking") }));
  confirm = await screen.findByRole("dialog", { name: t("ui.cancel.this.booking") });
  fireEvent.click(within(confirm).getByRole("button", { name: t("ui.cancel.booking") }));
  await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(cancelled));
  expect(cancelBooking).toHaveBeenCalledWith("bkg");
});

it("opens read-only in view mode until Edit is chosen", async () => {
  mount({ mode: "view" });
  const note = await screen.findByRole("textbox", { name: labelled("ui.booking.note") });
  expect(note.closest("fieldset")?.disabled).toBe(true);
  expect(screen.queryByRole("button", { name: t("ui.save.changes") })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: t("ui.edit.booking") }));
  expect(screen.getByRole("textbox", { name: labelled("ui.booking.note") }).closest("fieldset")?.disabled).toBe(false);
  expect(screen.getByRole("button", { name: t("ui.save.changes") })).toBeDefined();
});
