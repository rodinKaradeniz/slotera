"use client";

import * as React from "react";
import { useEntranceMode } from "@/components/layout/ScreenEnter";
import { motion, prefersReducedMotion } from "@/lib/motion";

// A whole number, optionally grouped ("8,420", "8.420", "8 420"), inside a label like "£8,420".
const NUMBER = /\d{1,3}(?:([,.   ])\d{3})+(?!\d)|\d+/;

/**
 * The label as it reads `fraction` (0-1) of the way to its value, or null when the label
 * has no whole number to count ("New", "4.5%").
 */
export function countUpFrame(value: string, fraction: number): string | null {
  const match = value.match(NUMBER);
  if (!match || /[.,]\d/.test(value.slice((match.index ?? 0) + match[0].length))) return null;
  const separator = match[1];
  let digits = String(Math.round(Number(match[0].replace(/\D/g, "")) * fraction));
  if (separator) digits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return value.slice(0, match.index) + digits + value.slice((match.index ?? 0) + match[0].length);
}

/**
 * A summary number that counts up to its value once, on the screen's first entrance this
 * session. Revisits, Reduce Motion and values that aren't whole numbers show the final
 * text straight away. Tabular figures keep the width steady while it counts.
 */
export function CountUp({ value }: { value: string }) {
  const mode = useEntranceMode();
  const animate =
    mode === "first" && countUpFrame(value, 1) !== null && countUpFrame(value, 0) !== value && !prefersReducedMotion();
  const [shown, setShown] = React.useState(() => (animate ? (countUpFrame(value, 0) ?? value) : value));

  React.useEffect(() => {
    if (!animate) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / motion.tick.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? (countUpFrame(value, eased) ?? value) : value);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
    // Runs once per mount: the count belongs to the first entrance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!animate) return <span className="tabular-nums">{value}</span>;
  // While counting, screen readers get the final value, not every step.
  return (
    <span className="tabular-nums">
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
