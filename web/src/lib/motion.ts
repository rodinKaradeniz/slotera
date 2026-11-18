/**
 * Motion tokens: the one source for every duration, curve and distance in the interface.
 * `globals.css` mirrors them as `--ease-*` / `--d-*` custom properties (checked by
 * `motion.test.ts`), so CSS and script move alike. Change a value here and in the CSS
 * together, never at a call site.
 */
export const motion = {
  /** The one ease-out curve. */
  easeOut: [0.2, 0.8, 0.2, 1],
  /** Sheets, drawers and dialogs sliding in. */
  sheetEase: [0.32, 0.72, 0, 1],

  pressScale: 0.97,
  press: 120,
  fade: 180,
  collapse: 200,
  sheet: 250,
  /** A leaving thing takes this share of its arrival's time. */
  exit: 0.8,

  popover: { in: 200, out: 160, from: 0.95 },
  rows: { stagger: 30, duration: 260, rise: 6, max: 10 },
  knob: { duration: 260, stretch: 0.12 },
  pulse: { duration: 360, scale: 1.06 },
  swap: { duration: 160, from: 0.85 },
  tab: { duration: 260, shift: 12 },
  entrance: { duration: 380, stagger: 70, rise: 8, steps: 14 },
  tick: { duration: 650 },
  loadingDelay: 250,
  reveal: { duration: 900, stagger: 90, steps: 8, rise: 14 },
} as const;

/** How long something takes to leave, given how long it took to arrive. */
export function exitMs(arrivalMs: number): number {
  return Math.round(arrivalMs * motion.exit);
}

/** True when the visitor asked the system for less motion. Safe on the server and in tests. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches === true
  );
}
