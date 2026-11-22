// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { browserStorage } from "@/test/browser-storage";
import { PackageChoice } from "./PackageChoice";
import type { ClientPackage } from "@/services/client-access.service";

beforeEach(() => vi.stubGlobal("localStorage", browserStorage()));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const pack: ClientPackage = {
  id: "pur", packageName: "Sprint Pack", priceCents: 50000, currency: "GBP", paymentStatus: "paid", status: "active",
  refundedCents: 0, usedCount: 1, remainingCount: 2, createdAt: "2035-01-01T09:00:00Z",
  sessions: [
    { position: 0, serviceId: "svc", title: "Kick-off", bookedFor: "2035-01-05T10:00:00Z" },
    { position: 1, serviceId: "svc", title: "Sprint", bookedFor: null },
    { position: 2, serviceId: "other", title: "Review", bookedFor: null },
  ],
};

it("counts the sessions left for this service and lets the client pay instead", () => {
  const onChange = vi.fn();
  render(<I18nProvider><PackageChoice packages={[pack]} chosenId="pur" serviceId="svc" onChange={onChange} /></I18nProvider>);
  const use = screen.getByRole("radio", { name: "Sprint Pack: 1 left" }) as HTMLInputElement;
  expect(use.checked).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "Pay for this session instead" }));
  expect(onChange).toHaveBeenCalledWith("");
});
