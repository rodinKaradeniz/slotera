// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { ConversationThread } from "./ConversationThread";
import {
  listMessages,
  sendMessage,
  markMessagesRead,
} from "@/services/messages.service";
vi.mock("@/services/messages.service", () => ({
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  markMessagesRead: vi.fn(),
}));
const page = { items: [], limit: 25, readThrough: 0, latestSequence: 0 };
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.mocked(listMessages).mockResolvedValue(page);
  vi.mocked(markMessagesRead).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it("refreshes only a visible mounted conversation and aborts on close", async () => {
  vi.useFakeTimers();
  let visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility as DocumentVisibilityState,
  );
  const view = render(
    <I18nProvider>
      <ConversationThread clientId="synthetic" />
    </I18nProvider>,
  );
  await act(async () => {});
  expect(listMessages).toHaveBeenCalledTimes(1);
  visibility = "hidden";
  await act(async () => vi.advanceTimersByTime(30000));
  expect(listMessages).toHaveBeenCalledTimes(1);
  visibility = "visible";
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(listMessages).toHaveBeenCalledTimes(2);
  const signal = vi.mocked(listMessages).mock.calls[0][1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => vi.advanceTimersByTime(30000));
  expect(listMessages).toHaveBeenCalledTimes(2);
});
it("preserves a failed draft and its idempotency key until explicit retry", async () => {
  vi.mocked(sendMessage)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({
      id: "m",
      sequence: 1,
      body: "Synthetic draft",
      senderKind: "operator",
      createdAt: "2026-11-16T12:00:00Z",
    });
  render(
    <I18nProvider>
      <ConversationThread clientId="synthetic" />
    </I18nProvider>,
  );
  await screen.findByText("No messages yet.");
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Synthetic draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByRole("alert");
  expect((input as HTMLTextAreaElement).value).toBe("Synthetic draft");
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText("Synthetic draft");
  expect(vi.mocked(sendMessage).mock.calls[0][2]).toBe(
    vi.mocked(sendMessage).mock.calls[1][2],
  );
  expect((input as HTMLTextAreaElement).value).toBe("");
});
