// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { CreateBookingDrawer } from "./CreateBookingDrawer";
import { createOperatorBooking } from "@/services/bookings.service";
import { searchClients } from "@/services/clients.service";
import { listBookableSessions } from "@/services/sessions.service";
import { browserStorage } from "@/test/browser-storage";
import { ApiRequestError } from "@/services/_errors";
import { packagesCovering } from "@/services/package-purchases.service";
vi.mock("@/services/bookings.service", () => ({ createOperatorBooking: vi.fn() }));
vi.mock("@/services/clients.service", () => ({ searchClients: vi.fn(), getClient: vi.fn() }));
vi.mock("@/services/sessions.service", () => ({ listBookableSessions: vi.fn(), getSession: vi.fn() }));
vi.mock("@/services/services.service", () => ({ serviceOptionsForIds: vi.fn().mockResolvedValue([{ id: "svc", name: "Sprint", priceCents: 24000, currency: "GBP" }]) }));
vi.mock("@/services/package-purchases.service", () => ({ packagesCovering: vi.fn() }));
vi.mock("@/lib/use-workspace-timezone", () => ({ useWorkspaceTimezone: () => "UTC" }));
vi.mock("@/components/ui/DrawerShell", () => ({ DrawerShell: ({ children, footer, open }: { children: React.ReactNode; footer: React.ReactNode; open: boolean }) => open ? <div>{children}{footer}</div> : null }));
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.mocked(searchClients).mockResolvedValue([]);
  vi.mocked(packagesCovering).mockResolvedValue([]);
  vi.mocked(listBookableSessions).mockResolvedValue({ items: [{ id: "s", serviceId: "svc", startISO: "2035-01-01T10:00:00Z", endISO: "2035-01-01T11:00:00Z", capacity: 1, bookedCount: 0, status: "scheduled", locationType: "online", location: "Call", recurring: "one-off" }], total: 1 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
function mount() { return render(<I18nProvider><ToastProvider><CreateBookingDrawer open onClose={vi.fn()} /></ToastProvider></I18nProvider>); }
it("validates a new client inline, preserves a rejected draft, and submits language and email opt-out", async () => {
  vi.mocked(createOperatorBooking).mockRejectedValueOnce(new ApiRequestError(409, "client_email_conflict", "Select that existing client."));
  mount();
  await waitFor(() => expect(screen.getByRole("button", { name: "Create booking" }).hasAttribute("disabled")).toBe(false));
  fireEvent.change(screen.getByRole("combobox", { name: "Client" }), { target: { value: "new" } });
  fireEvent.click(screen.getByRole("button", { name: "Create booking" }));
  expect(await screen.findByText("Enter a name.")).toBeDefined();
  expect(createOperatorBooking).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: /Full name/ }), { target: { value: "Draft client" } });
  fireEvent.change(screen.getByRole("textbox", { name: /^Email/ }), { target: { value: "draft@example.com" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Session/ }), { target: { value: "s" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Email language" }), { target: { value: "de" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Send details now" }));
  fireEvent.click(screen.getByRole("button", { name: "Create booking" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Select that existing client."));
  expect((screen.getByRole("textbox", { name: /Full name/ }) as HTMLInputElement).value).toBe("Draft client");
  expect(createOperatorBooking).toHaveBeenCalledWith(expect.objectContaining({ newClient: expect.objectContaining({ name: "Draft client" }), language: "de", sendEmail: false }), expect.any(String));
  fireEvent.click(screen.getByRole("button", { name: "Find existing client" }));
  await waitFor(() => expect(searchClients).toHaveBeenCalledWith("draft@example.com", expect.any(AbortSignal)));
});
it("retries a session load failure", async () => {
  vi.mocked(listBookableSessions).mockRejectedValueOnce(new Error("Offline"));
  mount();
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Offline"));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
it("offers a package that covers the session, then books it at no charge", async () => {
  vi.mocked(searchClients).mockResolvedValue([{ id: "cli", name: "Sofia", email: "sofia@example.com" } as never]);
  vi.mocked(packagesCovering).mockResolvedValue([{ id: "pur", packageName: "Sprint Pack", status: "active",
    items: [{ position: 0, serviceId: "svc", title: "Sprint", booking: null }, { position: 1, serviceId: "svc", title: "Sprint", booking: null }] } as never]);
  vi.mocked(createOperatorBooking).mockResolvedValue({ id: "b" } as never);
  mount();
  await screen.findByRole("option", { name: "Sofia · sofia@example.com" });
  // The second "Client" select picks the client; the first chooses existing or new.
  fireEvent.change(screen.getAllByRole("combobox", { name: /^Client/ })[1], { target: { value: "cli" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Session/ }), { target: { value: "s" } });
  expect(await screen.findByText("£240.00")).toBeDefined();
  const choice = await screen.findByRole("combobox", { name: "Package" });
  await waitFor(() => expect(packagesCovering).toHaveBeenCalledWith("cli", "svc"));
  expect(screen.getByRole("option", { name: "Sprint Pack (2 left)" })).toBeDefined();
  fireEvent.change(choice, { target: { value: "pur" } });
  expect(screen.queryByText("£240.00")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create booking" }));
  await waitFor(() => expect(createOperatorBooking).toHaveBeenCalledWith(expect.objectContaining({ clientId: "cli", packagePurchaseId: "pur" }), expect.any(String)));
});
