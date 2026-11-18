// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { writeLang } from "@/lib/i18n";
import { createActionItem, listTodoPage, toggleActionItemStatus } from "@/services/session-action-items.service";
import { TodoList } from "./TodoList";
vi.mock("@/services/session-action-items.service", () => ({
  listTodoPage: vi.fn(), createActionItem: vi.fn(), toggleActionItemStatus: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("localStorage", browserStorage());
  writeLang("en");
  vi.mocked(listTodoPage).mockResolvedValue({ items: [{ id: "todo-1", title: "Prepare notes", status: "todo", version: 3, createdAtISO: "2026-11-17T10:00:00Z", updatedAtISO: "2026-11-17T10:00:00Z" }], total: 1, offset: 0, limit: 25 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows a checklist with a New to-do button and uses reviewed versions when checking off", async () => {
  render(<I18nProvider><TodoList /></I18nProvider>);
  const checkbox = await screen.findByRole("checkbox", {name: "Prepare notes"});
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(screen.getByRole("button", {name: "New to-do"})).toBeDefined();
  expect(screen.queryByText("Action items")).toBeNull();
  fireEvent.click(checkbox);
  await waitFor(() => expect(toggleActionItemStatus).toHaveBeenCalledWith("todo-1", "todo", 3));
});
it("creates a to-do with a description from the modal and keeps entries after a failure", async () => {
  vi.mocked(createActionItem).mockRejectedValueOnce(new Error("Offline"));
  render(<I18nProvider><TodoList /></I18nProvider>);
  await screen.findByRole("checkbox");
  fireEvent.click(screen.getByRole("button", {name: "New to-do"}));
  const dialog = await screen.findByRole("dialog");
  const [title, description] = within(dialog).getAllByRole("textbox") as [HTMLInputElement, HTMLTextAreaElement];
  fireEvent.change(title, {target: {value: "Call Sofia"}});
  fireEvent.change(description, {target: {value: "Ask about the March workshop"}});
  await act(async () => { fireEvent.click(within(dialog).getByRole("button", {name: "Add to-do"})); });
  expect(await within(dialog).findByRole("alert")).toBeDefined();
  expect(title.value).toBe("Call Sofia");
  expect(createActionItem).toHaveBeenCalledWith({title: "Call Sofia", description: "Ask about the March workshop", status: "todo"});
  await act(async () => { fireEvent.click(within(dialog).getByRole("button", {name: "Add to-do"})); });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("shows one line of the description and expands the row to show all of it", async () => {
  vi.mocked(listTodoPage).mockResolvedValue({ items: [{ id: "todo-2", title: "Send recap", description: "Summarise the decisions and the open questions", status: "todo", version: 1, createdAtISO: "2026-11-17T10:00:00Z", updatedAtISO: "2026-11-17T10:00:00Z" }], total: 1, offset: 0, limit: 25 });
  render(<I18nProvider><TodoList /></I18nProvider>);
  const text = await screen.findByText("Summarise the decisions and the open questions");
  expect(text.className).toContain("truncate");
  const expand = screen.getByRole("button", {name: "Show the full description"});
  fireEvent.click(expand);
  expect(expand.getAttribute("aria-expanded")).toBe("true");
  expect(text.className).not.toContain("truncate");
});
