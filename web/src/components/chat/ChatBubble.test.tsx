// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ChatBubble } from "./ChatBubble";
import { ProgressiveText } from "./ProgressiveText";
import { UsageBar } from "./UsageBar";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("copies plain text and offers explicit edit without changing content", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const edit = vi.fn();
  render(
    <I18nProvider>
      <ChatBubble
        text="Synthetic message"
        createdAt="2026-11-17T12:00:00Z"
        onEdit={edit}
      />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
  await screen.findByRole("button", { name: "Copied" });
  expect(writeText).toHaveBeenCalledWith("Synthetic message");
  fireEvent.click(screen.getByRole("button", { name: "Edit and branch" }));
  expect(edit).toHaveBeenCalledOnce();
  expect(screen.getByText("Synthetic message")).toBeDefined();
});
it("shows validated text immediately with reduced motion", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  render(<ProgressiveText text="Already validated answer" animate />);
  expect(screen.getByText("Already validated answer")).toBeDefined();
});
it("caps the visible budget bar at its limit", () => {
  render(<UsageBar label="Daily answers" used={51} limit={50} />);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "50",
  );
});
