// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LoadError } from "./LoadError";

afterEach(cleanup);

describe("LoadError", () => {
  it("shows the message as an alert and retries on click", () => {
    const onRetry = vi.fn();
    render(<LoadError message="API is down" onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("API is down");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
