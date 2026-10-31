// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useDialogFocus } from "./use-dialog-focus";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useDialogFocus(open, ref);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <div ref={ref} tabIndex={-1} role="dialog">
          <button>First</button>
          <button onClick={() => setOpen(false)}>Last</button>
        </div>
      )}
    </>
  );
}

describe("useDialogFocus", () => {
  it("moves focus in, wraps Tab and Shift+Tab, and returns focus to the opener", () => {
    render(<Harness />);
    const opener = screen.getByText("Open");
    opener.focus();
    fireEvent.click(opener);

    const first = screen.getByText("First");
    const last = screen.getByText("Last");
    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.click(last);
    expect(document.activeElement).toBe(opener);
  });
});
