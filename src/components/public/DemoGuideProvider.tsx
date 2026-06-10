"use client";

import * as React from "react";
import { DemoGuidelinesModal } from "./DemoGuidelinesModal";

/**
 * Single source of truth for the Demo Guide modal across the public site.
 *
 * Mounted once in the `(public)` layout so every demo-intent trigger (nav
 * button, hero/strip/final CTA, footer link) opens the SAME modal instance via
 * `useDemoGuide().open()` instead of navigating straight to `/booking`. The
 * modal remains the central entry point for choosing: create demo account /
 * open admin dashboard / test the public booking page (incl. persona chips).
 *
 * Auto-open / sessionStorage behaviour is owned by `DemoGuideAutoOpen`, which
 * the landing page renders — keeping the once-per-session prompt landing-only
 * even though the provider also wraps the booking/reservation routes.
 */
const AUTOOPEN_KEY = "slotera.demoGuideSeen";

type Ctx = {
  open: () => void;
  /** Opens once per browser session; no-op if already shown. */
  openOnce: () => void;
};

const DemoGuideContext = React.createContext<Ctx | null>(null);

export function useDemoGuide(): Ctx {
  const ctx = React.useContext(DemoGuideContext);
  if (!ctx) throw new Error("useDemoGuide must be used within DemoGuideProvider");
  return ctx;
}

export function DemoGuideProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => setIsOpen(true), []);

  const openOnce = React.useCallback(() => {
    try {
      if (window.sessionStorage.getItem(AUTOOPEN_KEY) === "1") return;
      window.sessionStorage.setItem(AUTOOPEN_KEY, "1");
    } catch {
      // ignore — still open if storage is unavailable
    }
    setIsOpen(true);
  }, []);

  const value = React.useMemo<Ctx>(() => ({ open, openOnce }), [open, openOnce]);

  return (
    <DemoGuideContext.Provider value={value}>
      {children}
      <DemoGuidelinesModal open={isOpen} onClose={() => setIsOpen(false)} />
    </DemoGuideContext.Provider>
  );
}

/**
 * Drop this on the landing page to auto-open the Demo Guide once per session.
 * Renders nothing.
 */
export function DemoGuideAutoOpen() {
  const { openOnce } = useDemoGuide();
  React.useEffect(() => {
    openOnce();
  }, [openOnce]);
  return null;
}
