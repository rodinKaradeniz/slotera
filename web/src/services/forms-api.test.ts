import { beforeEach, expect, it, vi } from "vitest";
import type { FormTemplate } from "@/types/form";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/env", () => ({ dataSource: "api" }));
vi.mock("@/api/client", () => ({ apiRequest: request }));
import { updateForm, setFormServiceAttachment } from "./forms.service";
const form: FormTemplate = {
  id: "persisted-form", createdAtISO: "2026-01-01T00:00:00Z", name: "Prep",
  description: "", status: "active", requiredBeforePayment: false,
  attachedServiceIds: ["one"], fields: [{ id: "question", label: "When?", type: "date", required: false }],
};
beforeEach(() => { request.mockReset(); request.mockResolvedValue({ ...form, createdAt: form.createdAtISO }); });
it("sends writable form fields only when editing an existing record", async () => {
  await updateForm(form.id, form);
  const body = request.mock.calls[0][1].body;
  expect(body).not.toHaveProperty("id");
  expect(body).not.toHaveProperty("createdAtISO");
  expect(body.fields[0].type).toBe("date");
  expect(body.attachedServiceIds).toEqual(["one"]);
});
it("edits attachments from the persisted API form without reading demo fixtures", async () => {
  await setFormServiceAttachment(form.id, "two", true);
  expect(request.mock.calls[0][0]).toBe("/forms/persisted-form");
  expect(request.mock.calls[1][1].body).toEqual({ attachedServiceIds: ["one", "two"] });
});
it("normalizes choices at save time without sending options on date questions", async () => {
  await updateForm(form.id, { fields: [
    { id: "choice", label: "Topic", type: "multi_select", required: false, options: [" Deep work ", "", "Planning"] },
    { ...form.fields[0], options: ["stale"] },
  ] });
  const fields = request.mock.calls[0][1].body.fields;
  expect(fields[0].options).toEqual(["Deep work", "Planning"]);
  expect(fields[1]).not.toHaveProperty("options");
});
