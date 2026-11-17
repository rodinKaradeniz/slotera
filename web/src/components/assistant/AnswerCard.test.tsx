// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { writeLang, translate, type Lang } from "@/lib/i18n";
import { browserStorage } from "@/test/browser-storage";
import { AnswerCard } from "./AnswerCard";
import { confirmAI, type AITurn } from "@/services/assistant.service";
import { ApiRequestError } from "@/services/_errors";
vi.mock("@/services/assistant.service", () => ({
  confirmAI: vi.fn(),
  recoverAI: vi.fn(),
}));
const turn: AITurn = {
  id: "synthetic",
  threadId: "thread",
  prompt: "Add task",
  language: "en",
  answer: "Recorded summary",
  status: "completed",
  citations: [
    { id: "known", title: "Known source", href: "/admin/clients/known" },
  ],
  proposal: {
    hash: "a".repeat(64),
    status: "proposed",
    action: { name: "task.create" },
    changes: { title: "Reviewed task" },
    before: {},
    timezone: "UTC",
  },
  errorCode: null,
  createdAt: "2026-11-17T09:00:00Z",
};
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it.each(["en", "tr", "de"] as Lang[])(
  "requires a separate confirmation in %s",
  async (lang) => {
    writeLang(lang);
    const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
    vi.mocked(confirmAI).mockResolvedValue({
      ...turn,
      proposal: { ...turn.proposal, status: "executed" },
    });
    const saved = vi.fn();
    render(
      <I18nProvider>
        <AnswerCard turn={turn} onChange={saved} />
      </I18nProvider>,
    );
    expect(confirmAI).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t("ai.review") }));
    expect(confirmAI).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t("ui.cancel") }));
    expect(confirmAI).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t("ai.review") }));
    fireEvent.click(screen.getByRole("button", { name: t("ai.confirm") }));
    await waitFor(() => expect(confirmAI).toHaveBeenCalledTimes(1));
    expect(vi.mocked(confirmAI).mock.calls[0].slice(0, 2)).toEqual([
      turn.id,
      "a".repeat(64),
    ]);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("link", { name: "Known source" }).getAttribute("href"),
    ).toBe("/admin/clients/known");
  },
);
it("keeps the reviewed values and requires a fresh proposal after a stale-write rejection", async () => {
  writeLang("en");
  vi.mocked(confirmAI).mockRejectedValue(
    new ApiRequestError(
      409,
      "resource_stale",
      "Record changed",
      "safe-reference",
    ),
  );
  render(
    <I18nProvider>
      <AnswerCard turn={turn} />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Review change" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Reviewed task")).toBeDefined();
  expect(
    screen
      .getByRole("button", { name: "Review change" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByRole("alert").textContent).toContain("safe-reference");
});
