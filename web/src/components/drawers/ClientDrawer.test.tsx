// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { translate } from "@/lib/i18n";
import { browserStorage } from "@/test/browser-storage";
import { ApiRequestError } from "@/services/_errors";
import { createClient, updateClient } from "@/services/clients.service";
import { ClientDrawer } from "./ClientDrawer";
import type { Client } from "@/types/client";
vi.mock("@/services/clients.service", () => ({ createClient: vi.fn(), updateClient: vi.fn(), getClient: vi.fn() }));
vi.mock("@/components/ui/DrawerShell", () => ({ DrawerShell: ({ children, footer, open }: { children: React.ReactNode; footer: React.ReactNode; open: boolean }) => open ? <div>{children}{footer}</div> : null }));

const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
const labelled = (key: Parameters<typeof translate>[1]) => new RegExp(t(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const existing = { id: "cli", name: "Ada Client", email: "ada@example.com", version: 3 } as Client;

beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function mount(props: { initial?: Client; onSaved?: (client: Client) => void; onClose?: () => void } = {}) {
  return render(<I18nProvider><ToastProvider><ClientDrawer open onClose={props.onClose ?? vi.fn()} initial={props.initial} onSaved={props.onSaved} /></ToastProvider></I18nProvider>);
}
const field = (key: Parameters<typeof translate>[1]) => screen.getByRole("textbox", { name: labelled(key) });
const save = () => fireEvent.click(screen.getByRole("button", { name: t("ui.save.client") }));

it("validates a new client inline and saves the trimmed name and email", async () => {
  const onSaved = vi.fn();
  vi.mocked(createClient).mockImplementation(async (input) => ({ ...existing, ...input }));
  mount({ onSaved });
  fireEvent.change(field("ui.email"), { target: { value: "not-an-email" } });
  save();
  expect(await screen.findByText(t("booking.create.nameRequired"))).toBeDefined();
  expect(screen.getByText(t("booking.create.emailInvalid"))).toBeDefined();
  await waitFor(() => expect(document.activeElement).toBe(field("ui.full.name")));
  expect(createClient).not.toHaveBeenCalled();
  fireEvent.change(field("ui.full.name"), { target: { value: "  Grace Client " } });
  fireEvent.change(field("ui.email"), { target: { value: " grace@example.com " } });
  save();
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ name: "Grace Client", email: "grace@example.com" }));
});

it("asks before moving a client to a new email and sends the edit with its version and review key", async () => {
  vi.mocked(updateClient).mockImplementation(async (_id, input) => ({ ...existing, ...input }));
  mount({ initial: existing });
  fireEvent.change(field("ui.email"), { target: { value: "ada@new.example.com" } });
  save();
  const review = await screen.findByRole("dialog", { name: t("client.transferTitle") });
  expect(review.textContent).toContain("ada@new.example.com");
  expect(updateClient).not.toHaveBeenCalled();
  fireEvent.click(within(review).getByRole("button", { name: t("client.transferConfirm") }));
  await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
  expect(updateClient).toHaveBeenCalledWith("cli", expect.objectContaining({ email: "ada@new.example.com" }), 3, { key: expect.any(String) });
});

it("saves a change that keeps the email without asking", async () => {
  vi.mocked(updateClient).mockImplementation(async (_id, input) => ({ ...existing, ...input }));
  mount({ initial: existing });
  fireEvent.change(field("ui.email"), { target: { value: "ADA@example.com " } });
  fireEvent.change(field("ui.role"), { target: { value: "Founder" } });
  save();
  await waitFor(() => expect(updateClient).toHaveBeenCalledWith("cli", expect.objectContaining({ role: "Founder" }), 3, undefined));
  expect(screen.queryByRole("dialog", { name: t("client.transferTitle") })).toBeNull();
});

it("shows the stale-edit notice and keeps the draft when someone else saved first", async () => {
  const onClose = vi.fn();
  vi.mocked(updateClient).mockRejectedValue(new ApiRequestError(409, "resource_stale", "Changed elsewhere"));
  mount({ initial: existing, onClose });
  fireEvent.change(field("ui.role"), { target: { value: "Founder" } });
  save();
  expect(await screen.findByText(t("editing.stale"))).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();
  expect((field("ui.role") as HTMLInputElement).value).toBe("Founder");
});
