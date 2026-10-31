import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import { tr } from "./messages/tr";
import { de } from "./messages/de";

// TR and DE are typed `Partial<Messages>` so a missing key falls back to English at
// runtime; this makes sure nothing is left untranslated by accident.
describe("translations", () => {
  const keys = Object.keys(en);

  it.each([
    ["tr", tr],
    ["de", de],
  ] as const)("%s has every English key", (_name, messages) => {
    const missing = keys.filter((key) => !(key in messages));
    expect(missing).toEqual([]);
  });

  it.each([
    ["tr", tr],
    ["de", de],
  ] as const)("%s has no keys English does not", (_name, messages) => {
    const extra = Object.keys(messages).filter((key) => !(key in en));
    expect(extra).toEqual([]);
  });
});
