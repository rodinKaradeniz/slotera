"use client";

import * as React from "react";
import { DemoGuidelinesModal } from "./DemoGuidelinesModal";
import { cn } from "@/lib/cn";

const AUTOOPEN_KEY = "slotera.demoGuideSeen";

type Variant = "link" | "ghost";

type Props = {
  /** Open the modal once per browser session when this mounts. Use on landing pages. */
  autoOpen?: boolean;
  /** Visual style of the trigger. `link` is a quiet text link, `ghost` is a pill button. */
  variant?: Variant;
  className?: string;
};

export function DemoGuideButton({
  autoOpen = false,
  variant = "link",
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!autoOpen) return;
    try {
      if (window.sessionStorage.getItem(AUTOOPEN_KEY) === "1") return;
      window.sessionStorage.setItem(AUTOOPEN_KEY, "1");
    } catch {
      // ignore — still open if storage is unavailable
    }
    setOpen(true);
  }, [autoOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 select-none",
          variant === "link"
            ? "text-[14px] text-ink-2 hover:text-ink"
            : "h-9 px-3 rounded-md border border-line bg-surface text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink transition-colors",
          className,
        )}
        aria-label="Open demo guide"
      >
        Demo
      </button>
      <DemoGuidelinesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
