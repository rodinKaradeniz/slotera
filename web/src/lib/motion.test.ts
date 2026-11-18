import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exitMs, motion } from "./motion";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function cssVar(name: string): string {
  const match = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"));
  if (!match) throw new Error(`--${name} is missing from globals.css`);
  return match[1].trim();
}

const bezier = (points: readonly number[]) => `cubic-bezier(${points.join(", ")})`;

describe("motion tokens", () => {
  it("globals.css mirrors every token in motion.ts", () => {
    const expected: Record<string, string> = {
      "ease-out": bezier(motion.easeOut),
      "ease-sheet": bezier(motion.sheetEase),
      "press-scale": String(motion.pressScale),
      "d-press": `${motion.press}ms`,
      "d-fade": `${motion.fade}ms`,
      "d-collapse": `${motion.collapse}ms`,
      "d-sheet": `${motion.sheet}ms`,
      "d-sheet-out": `${exitMs(motion.sheet)}ms`,
      "d-popover-in": `${motion.popover.in}ms`,
      "d-popover-out": `${motion.popover.out}ms`,
      "popover-from": String(motion.popover.from),
      "d-swap": `${motion.swap.duration}ms`,
      "d-rows": `${motion.rows.duration}ms`,
      "stagger-rows": `${motion.rows.stagger}ms`,
      "rise-rows": `${motion.rows.rise}px`,
      "d-knob": `${motion.knob.duration}ms`,
      "d-pulse": `${motion.pulse.duration}ms`,
      "d-tab": `${motion.tab.duration}ms`,
      "shift-tab": `${motion.tab.shift}px`,
      "d-entrance": `${motion.entrance.duration}ms`,
      "stagger-entrance": `${motion.entrance.stagger}ms`,
      "rise-entrance": `${motion.entrance.rise}px`,
      "loading-delay": `${motion.loadingDelay}ms`,
      "d-reveal": `${motion.reveal.duration}ms`,
      "stagger-reveal": `${motion.reveal.stagger}ms`,
      "rise-reveal": `${motion.reveal.rise}px`,
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(cssVar(name), `--${name}`).toBe(value);
    }
  });

  it("keeps exits faster than entrances", () => {
    expect(exitMs(motion.sheet)).toBeLessThan(motion.sheet);
    expect(motion.popover.out).toBe(exitMs(motion.popover.in));
  });

  it("uses no literal curves outside the token block", () => {
    const outsideRoot = css.slice(css.indexOf("/* shadow values live"));
    expect(outsideRoot).not.toMatch(/cubic-bezier\(/);
  });
});
