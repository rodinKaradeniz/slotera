// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ConversationRow } from "./ConversationRow";
afterEach(cleanup);
it("opens deletion through right-click or keyboard without opening the conversation", () => {
  const open = vi.fn(),
    remove = vi.fn();
  render(
    <I18nProvider>
      <ConversationRow
        thread={{
          id: "synthetic",
          title: "Planning our next session",
          createdAt: "2026-11-17T12:00:00Z",
        }}
        active={false}
        busy={false}
        onOpen={open}
        onDelete={remove}
      />
    </I18nProvider>,
  );
  expect(screen.queryByRole("menuitem")).toBeNull();
  fireEvent.contextMenu(screen.getByText("Planning our next session"));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete chat" }));
  expect(remove).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Conversation options" }),
    { key: "F10", shiftKey: true },
  );
  expect(screen.getByRole("menuitem")).toBeDefined();
  fireEvent.keyDown(screen.getByRole("menuitem"), { key: "Escape" });
  expect(screen.queryByRole("menuitem")).toBeNull();
});
