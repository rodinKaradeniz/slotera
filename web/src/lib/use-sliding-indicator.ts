"use client";

import * as React from "react";

/**
 * Positions one `.slide-indicator` under the active item of a segmented control or tab
 * list, so the selection slides between items instead of jumping. Items are found by
 * `[data-active="true"]` inside the container. It re-measures when the selection or the
 * container's size changes (fonts loading, a translated label). The first placement
 * doesn't animate.
 */
export function useSlidingIndicator(active: string) {
  const container = React.useRef<HTMLDivElement>(null);
  const indicator = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const root = container.current;
    const bar = indicator.current;
    if (!root || !bar) return;
    const place = () => {
      const item = root.querySelector<HTMLElement>('[data-active="true"]');
      bar.style.opacity = item ? "1" : "0";
      if (!item) return;
      bar.style.setProperty("--x", `${item.offsetLeft}px`);
      bar.style.setProperty("--w", `${item.offsetWidth}px`);
    };
    place();
    // Let the first placement land before transitions switch on.
    const frame = requestAnimationFrame(() => (bar.dataset.ready = "true"));
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [active]);

  return { container, indicator };
}
