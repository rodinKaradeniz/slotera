import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a custom typography class next to a text colour", () => {
    // Regression: tailwind-merge treated `text-h1` and `text-ink` as the same group.
    expect(cn("text-h1", "text-ink")).toBe("text-h1 text-ink");
  });

  it("still lets a later class of the same group win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-h1", "text-small")).toBe("text-small");
  });

  it("drops falsy inputs", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});
