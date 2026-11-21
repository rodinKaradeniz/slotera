// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { translate } from "@/lib/i18n";
import { browserStorage } from "@/test/browser-storage";
import { moveBooking } from "@/services/bookings.service";
import { getSession, listBookableSessions } from "@/services/sessions.service";
import { MoveBookingDialog } from "./MoveBookingDialog";
import type { Booking } from "@/types/booking";
import type { SessionItem } from "@/types/session";
vi.mock("@/services/bookings.service", () => ({ moveBooking: vi.fn() }));
vi.mock("@/services/sessions.service", () => ({ getSession: vi.fn(), listBookableSessions: vi.fn() }));
vi.mock("@/lib/use-workspace-timezone", () => ({ useWorkspaceTimezone: () => "UTC" }));

const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
const session = (id: string, startISO: string, extra: Partial<SessionItem> = {}): SessionItem => ({
  id, serviceId: "svc", startISO, endISO: startISO.replace("T10", "T11"), capacity: 1, bookedCount: 0,
  status: "scheduled", locationType: "online", location: "Call", recurring: "one-off", ...extra,
});
const booking: Booking = {
  id: "bkg", sessionId: "current", clientId: "cli", status: "confirmed", paymentStatus: "free",
  amountCents: 0, currency: "EUR", createdAtISO: "2035-01-01T09:00:00Z",
};

beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.mocked(getSession).mockResolvedValue(session("current", "2035-01-02T10:00:00Z"));
  vi.mocked(listBookableSessions).mockResolvedValue({ total: 3, items: [
    session("current", "2035-01-02T10:00:00Z"),
    session("later", "2035-01-09T10:00:00Z"),
    session("group", "2035-01-16T10:00:00Z", { capacity: 4, bookedCount: 1 }),
  ] });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function mount(props: { onMoved?: (b: Booking) => void; onClose?: () => void } = {}) {
  return render(
    <I18nProvider><ToastProvider>
      <MoveBookingDialog open booking={booking} onClose={props.onClose ?? vi.fn()} onMoved={props.onMoved ?? vi.fn()} />
    </ToastProvider></I18nProvider>,
  );
}
const labelled = (key: Parameters<typeof translate>[1]) => new RegExp(t(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const sessionSelect = () => screen.getByRole("combobox", { name: labelled("ui.new.session") });
const moveButton = () => screen.getByRole("button", { name: t("ui.move.booking") });

it("offers only the other sessions of the booking's service and needs a choice and a reason", async () => {
  mount();
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
  expect(listBookableSessions).toHaveBeenCalledWith(0, "svc");
  const values = screen.getAllByRole("option").map((option) => (option as HTMLOptionElement).value);
  expect(values).toEqual(["", "later", "group"]);
  expect(screen.getByRole("option", { name: /Jan.*10:00.*3/ })).toBeDefined();
  expect(moveButton().hasAttribute("disabled")).toBe(true);
  fireEvent.change(sessionSelect(), { target: { value: "later" } });
  expect(moveButton().hasAttribute("disabled")).toBe(false);
  fireEvent.change(screen.getByRole("textbox", { name: labelled("ui.reason.recorded.in.the.audit.log") }), { target: { value: "  " } });
  expect(moveButton().hasAttribute("disabled")).toBe(true);
});

it("keeps the dialog open on a failed move and retries with the same idempotency key", async () => {
  const onMoved = vi.fn();
  const onClose = vi.fn();
  const moved = { ...booking, sessionId: "later" };
  vi.mocked(moveBooking).mockRejectedValueOnce(new Error("Session is full")).mockResolvedValueOnce(moved);
  mount({ onMoved, onClose });
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
  fireEvent.change(sessionSelect(), { target: { value: "later" } });
  fireEvent.click(moveButton());
  expect(await screen.findByText("Session is full")).toBeDefined();
  expect(onMoved).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await waitFor(() => expect(moveButton().hasAttribute("disabled")).toBe(false));
  fireEvent.click(moveButton());
  await waitFor(() => expect(onMoved).toHaveBeenCalledWith(moved));
  expect(onClose).toHaveBeenCalledTimes(1);
  const [first, second] = vi.mocked(moveBooking).mock.calls;
  expect(first).toEqual(["bkg", { sessionId: "later", auditReason: "Moved at the provider's request." }, expect.any(String)]);
  expect(second[2]).toBe(first[2]);
});

it("shows a load failure with a retry and blocks the move until sessions load", async () => {
  vi.mocked(listBookableSessions).mockRejectedValueOnce(new Error("Offline"));
  mount();
  expect(await screen.findByText("Offline")).toBeDefined();
  expect(moveButton().hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: t("ui.try.again") }));
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
  expect(screen.queryByText("Offline")).toBeNull();
});
