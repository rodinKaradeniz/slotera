"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * A checkbox whose tick draws itself in when checked (and erases quickly when cleared),
 * so finishing something reads as finished. The hit area is 32px around an 18px box.
 */
export function Checkbox({ checked, onChange, disabled, className, ...rest }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "check press group/check -m-[7px] p-[7px] shrink-0 rounded-md disabled:opacity-60",
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "flex w-[18px] h-[18px] items-center justify-center rounded-[5px] border transition-colors duration-(--d-fade) ease-out",
          checked ? "bg-accent border-accent text-white" : "bg-surface border-ink-4 group-hover/check:border-ink-3",
        )}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden className="check-tick">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
