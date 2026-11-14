// @vitest-environment jsdom
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ApiRequestError } from "@/services/_errors";
import { browserStorage } from "@/test/browser-storage";
import { useReviewedEdit } from "./use-reviewed-edit";
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
it("keeps a stale draft until the operator explicitly reviews and replaces it", async () => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  const load = vi.fn().mockResolvedValue({id: "one", version: 2, name: "Changed elsewhere"});
  function Editor() {
    const [draft, setDraft] = React.useState("My unsaved name");
    const edit = useReviewedEdit(true, {id: "one", version: 1, name: "Initial"}, load, (value) => setDraft(value.name));
    return <>{edit.notice}<input aria-label="Name" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button onClick={() => edit.onError(new ApiRequestError(409, "resource_stale", "stale"))}>Save</button>
      <output>{edit.version}</output></>;
  }
  render(<I18nProvider><Editor /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", {name: "Save"}));
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("My unsaved name");
  expect(load).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Review latest version"}));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", {name: "Load latest version"}));
  await screen.findByDisplayValue("Changed elsewhere");
  expect(screen.getByRole("status").textContent).toBe("2");
  expect(load).toHaveBeenCalledTimes(1);
});
