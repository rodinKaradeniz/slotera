// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { writeLang, type Lang } from "@/lib/i18n";
import { BookingForms } from "./BookingForms";
import { listManagedForms, submitManagedForm } from "@/services/booking-forms.service";
import { browserStorage } from "@/test/browser-storage";

vi.mock("@/services/booking-forms.service", () => ({ listManagedForms: vi.fn(), submitManagedForm: vi.fn(), listBookingForms: vi.fn() }));
beforeEach(() => { vi.stubGlobal("localStorage", browserStorage()); });
afterEach(() => { cleanup(); writeLang("en"); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const form = { id: "form", name: "Consultant's question", description: "Original description", fields: [{ id: "q", label: "Continue?", type: "yes_no" as const, required: true }], requiredBeforePayment: false, answers: null, submittedAt: null, assignmentKind: "preparation" as const, responseDeadline: null, canSubmit: true };

describe("booking forms", () => {
  it.each([ ["en", "Submit answers", "No"], ["tr", "Yanıtları gönder", "Hayır"], ["de", "Antworten absenden", "Nein"] ] as [Lang, string, string][])("submits a false answer once in %s without translating consultant content", async (language, submit, no) => {
    writeLang(language);
    vi.mocked(listManagedForms).mockResolvedValue([form]);
    vi.mocked(submitManagedForm).mockResolvedValue([{ ...form, canSubmit: false, submittedAt: "2030-01-01T09:00:00Z", answers: [{ fieldId: "q", value: false }] }]);
    render(<I18nProvider><BookingForms token="local-test-token" /></I18nProvider>);
    fireEvent.click(await screen.findByRole("radio", { name: no }));
    fireEvent.click(screen.getByRole("button", { name: submit }));
    await waitFor(() => expect(submitManagedForm).toHaveBeenCalledWith("local-test-token", "form", [{ fieldId: "q", value: false }]));
    await waitFor(() => expect(screen.queryByRole("button", { name: submit })).toBeNull());
    expect(screen.getByText("Consultant's question")).toBeDefined();
  });
  it("recovers from a failed load", async () => {
    vi.mocked(listManagedForms).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce([]);
    render(<I18nProvider><BookingForms token="local-test-token" /></I18nProvider>);
    expect(await screen.findByRole("alert")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No forms for this booking.")).toBeDefined();
  });
});
