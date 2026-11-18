"use client";

import * as React from "react";
import { motion, prefersReducedMotion } from "@/lib/motion";

/**
 * Marketing pages only: blocks below the fold rise softly into place the first time they
 * are scrolled to, a beat apart when several arrive together. Targets each landing
 * section's direct blocks, or the `[data-reveal]` items inside a block that marks its own.
 * Only blocks that are still off screen when this runs are hidden, so nothing visible
 * ever disappears, and without the script (or under Reduce Motion) everything is
 * simply there.
 */
export function ScrollReveal() {
  React.useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("main section > div > *"));
    const targets = blocks.flatMap((block) => {
      const own = Array.from(block.querySelectorAll<HTMLElement>("[data-reveal]"));
      return own.length ? own : [block];
    });
    const below = targets.filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    for (const el of below) el.dataset.revealState = "waiting";

    const observer = new IntersectionObserver(
      (entries) => {
        const arriving = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement);
        arriving.forEach((el, i) => {
          const step = Math.min(i, motion.reveal.steps - 1);
          el.style.setProperty("--reveal-delay", `${step * motion.reveal.stagger}ms`);
          el.dataset.revealState = "shown";
          observer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of below) observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return null;
}
