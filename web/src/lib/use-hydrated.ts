"use client";

import * as React from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Use it to gate portals and
 * browser-only reads (localStorage) without a mount-flag effect.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
