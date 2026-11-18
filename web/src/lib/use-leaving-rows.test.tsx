// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLeavingRows } from "./use-leaving-rows";

function List({ items }: { items: string[] }) {
  const rows = useLeavingRows(items, (item) => item);
  return <ul>{rows.map(({ item, leaving }) => <li key={item} data-leaving={leaving || undefined}>{item}</li>)}</ul>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const shown = () => screen.getAllByRole("listitem").map((li) => `${li.textContent}${li.dataset.leaving ? "*" : ""}`);

it("keeps a removed row in its old place while it leaves, then drops it", () => {
  const { rerender } = render(<List items={["a", "b", "c"]} />);
  rerender(<List items={["a", "c"]} />);
  expect(shown()).toEqual(["a", "b*", "c"]);
  act(() => void vi.advanceTimersByTime(250));
  expect(shown()).toEqual(["a", "c"]);
});

it("does nothing when the same rows arrive in a new array", () => {
  const { rerender } = render(<List items={["a", "b"]} />);
  rerender(<List items={["a", "b"]} />);
  expect(shown()).toEqual(["a", "b"]);
});

it("drops removed rows at once under Reduce Motion", () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
  const { rerender } = render(<List items={["a", "b"]} />);
  rerender(<List items={["b"]} />);
  expect(shown()).toEqual(["b"]);
});
