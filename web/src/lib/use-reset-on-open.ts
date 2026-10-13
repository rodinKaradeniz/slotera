"use client";

import * as React from "react";

/**
 * Runs `reset` during render when a drawer or modal opens, or when one of `deps` changes
 * while it is open. This is React's "adjust state when a prop changes" pattern: the form
 * starts from fresh values on the same render instead of flashing stale ones and
 * re-rendering from an effect. `reset` may only set this component's own state.
 */
export function useResetOnOpen(open: boolean, deps: unknown[], reset: () => void): void {
  const [seen, setSeen] = React.useState({ open, deps });
  const changed =
    seen.open !== open ||
    seen.deps.length !== deps.length ||
    seen.deps.some((value, index) => !Object.is(value, deps[index]));
  if (changed) {
    setSeen({ open, deps });
    if (open) reset();
  }
}
