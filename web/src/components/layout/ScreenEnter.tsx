"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { hasSeenScreen, markScreenSeen, screenKey } from "@/lib/motion-session";

export type EntranceMode = "first" | "again";

const EntranceContext = React.createContext<EntranceMode>("again");

/** Whether this screen is opening for the first time this session (for one-off moments). */
export function useEntranceMode(): EntranceMode {
  return React.useContext(EntranceContext);
}

/**
 * Wraps a route's page (from a `template.tsx`, which remounts on every navigation). The
 * first visit to a screen in a session rises its sections into place top to bottom; a
 * revisit only fades them. Sections inserted later (content replacing a loader) arrive
 * the same way. `display: contents`, so it never affects layout; all motion is in
 * `globals.css` under `.screen`.
 */
export function ScreenEnter({ children }: { children: React.ReactNode }) {
  const screen = screenKey(usePathname() ?? "/");
  const [mode] = React.useState<EntranceMode>(() => (hasSeenScreen(screen) ? "again" : "first"));
  React.useEffect(() => markScreenSeen(screen), [screen]);
  return (
    <EntranceContext.Provider value={mode}>
      <div className="screen contents" data-enter={mode}>
        {children}
      </div>
    </EntranceContext.Provider>
  );
}
