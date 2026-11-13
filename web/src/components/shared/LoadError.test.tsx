// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { LoadError } from "./LoadError";

afterEach(cleanup);

describe("LoadError", () => {
  it("shows the message as an alert and retries on click", () => {
    const onRetry = vi.fn();
    render(<I18nProvider><LoadError message="API is down" onRetry={onRetry} /></I18nProvider>);
    expect(screen.getByRole("alert").textContent).toContain("API is down");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
