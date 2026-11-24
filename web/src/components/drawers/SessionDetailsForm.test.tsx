// @vitest-environment jsdom
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { SessionDetailsForm, emptyForm, type FormState } from "./SessionDetailsForm";

vi.mock("@/lib/use-workspace-timezone", () => ({ useWorkspaceTimezone: () => "Europe/Berlin" }));
afterEach(cleanup);

function Harness({ seen }: { seen: (form: FormState) => void }) {
  const [form, setForm] = React.useState<FormState>({ ...emptyForm([]), date: "2030-05-07" });
  seen(form);
  return (
    <SessionDetailsForm form={form} setForm={setForm} services={[]} savedLocations={[]} isEdit={false} isView={false}
      scope="this" setScope={vi.fn()} serviceSearch="" setServiceSearch={vi.fn()} lookupError={null}
      onRetryLookup={vi.fn()} conflict={null} busy={false} onCancelSession={vi.fn()} />
  );
}

it("sets up a custom rule from the start date's weekday, every N weeks on chosen days", () => {
  let latest = emptyForm([]);
  render(<I18nProvider><Harness seen={(form) => { latest = form; }} /></I18nProvider>);
  expect(screen.queryByRole("button", { name: "Tue" })).toBeNull();

  fireEvent.change(screen.getByRole("combobox", { name: "Recurrence" }), { target: { value: "custom" } });
  // 7 May 2030 is a Tuesday, so Tuesday starts selected.
  expect(screen.getByRole("button", { name: "Tue" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Thu" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /Repeat every/ }), { target: { value: "2" } });
  expect(latest).toMatchObject({ recurring: "custom", intervalWeeks: 2, weekdays: [2, 4] });

  fireEvent.click(screen.getByRole("button", { name: "Tue" }));
  expect(latest.weekdays).toEqual([4]);
});
