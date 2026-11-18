"use client";

import * as React from "react";
import { prefersReducedMotion } from "@/lib/motion";

export type PresenceState = "open" | "closed";

export type Presence = {
  /** Keep the element in the DOM: true while open and through its exit animation. */
  rendered: boolean;
  /** Drives the CSS transition: "open" a frame after mounting, "closed" while leaving. */
  state: PresenceState;
  /** True only while the element is animating out; make it `inert` and drop dialog roles. */
  closing: boolean;
};

/**
 * Mount/unmount with enter and exit transitions. The element mounts "closed", flips to
 * "open" two frames later so its transition runs, and on close stays mounted for `exitMs`
 * before unmounting. Under Reduce Motion it unmounts at once.
 *
 * `appear: false` skips the entrance when the element is open on first render (an
 * accordion that starts expanded).
 */
export function usePresence(
  open: boolean,
  exitMs: number,
  { appear = true }: { appear?: boolean } = {},
): Presence {
  const [rendered, setRendered] = React.useState(open);
  const [entered, setEntered] = React.useState(!appear && open);
  if (open && !rendered) setRendered(true);

  React.useEffect(() => {
    if (open) {
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    if (!rendered) return;
    const t = window.setTimeout(
      () => {
        setRendered(false);
        setEntered(false);
      },
      prefersReducedMotion() ? 0 : exitMs,
    );
    return () => window.clearTimeout(t);
  }, [open, rendered, exitMs]);

  return {
    rendered: open || rendered,
    state: open && entered ? "open" : "closed",
    closing: !open && rendered,
  };
}
