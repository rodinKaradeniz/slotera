// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { FormTemplateForm, type FormTemplateFormValue } from "./FormTemplateForm";
vi.mock("@/services/services.service", () => ({ listServices: async () => [
  { id: "one", name: "First service", active: true }, { id: "two", name: "Second service", active: true },
] }));
beforeEach(() => vi.stubGlobal("localStorage", browserStorage()));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Editor() {
  const [value, setValue] = React.useState<FormTemplateFormValue>({ name: "Prep", description: "", status: "active", fields: [
    { id: "q", label: "Topic", type: "short_text", required: false },
  ], attachedServiceIds: [], requiredBeforePayment: false });
  return <I18nProvider><FormTemplateForm value={value} onChange={setValue} /><output data-testid="value">{JSON.stringify(value)}</output></I18nProvider>;
}
it("keeps spaces while editing choices and uses Enter to advance or add an option", () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "multi_select" } });
  const first = screen.getByRole("textbox", { name: "Option 1" });
  const second = screen.getByRole("textbox", { name: "Option 2" });
  fireEvent.change(first, { target: { value: "Deep work " } });
  expect((first as HTMLInputElement).value).toBe("Deep work ");
  fireEvent.keyDown(first, { key: "Enter" });
  expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: "Enter" });
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Option 3" }));
  fireEvent.click(screen.getByRole("button", { name: "Add option" }));
  expect(screen.getByRole("textbox", { name: "Option 4" })).toBeDefined();
});
it("switches choices to dates and independently changes service attachments", async () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "multi_select" } });
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "date" } });
  fireEvent.click(await screen.findByLabelText("Second service"));
  const value = JSON.parse(screen.getByTestId("value").textContent!);
  expect(value.fields[0].type).toBe("date");
  expect(value.fields[0].options).toBeUndefined();
  expect(value.attachedServiceIds).toEqual(["two"]);
});
