"use client";

import * as React from "react";
import { motion, prefersReducedMotion } from "@/lib/motion";

/**
 * Animates an element's height from what it was to what it is whenever `dependency`
 * changes (a row expanding to its full text), so its neighbours glide rather than jump.
 * Give the element `overflow-hidden`.
 */
export function useHeightTransition<T extends HTMLElement>(dependency: unknown) {
  const ref = React.useRef<T>(null);
  const last = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const next = element.getBoundingClientRect().height;
    const previous = last.current;
    last.current = next;
    if (previous === null || previous === next || prefersReducedMotion() || !element.animate) return;
    element.animate([{ height: `${previous}px` }, { height: `${next}px` }], {
      duration: motion.collapse,
      easing: `cubic-bezier(${motion.easeOut.join(", ")})`,
    });
  }, [dependency]);
  return ref;
}
