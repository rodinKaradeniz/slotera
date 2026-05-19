"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
};

/**
 * Knob sits inside the track via flexbox `items-center`, with the inner area
 * sized so the knob exactly fills it vertically. Avoids the absolute/
 * top:50% + transform pattern which sub-pixel-rounded the knob a hair high.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  size = "md",
  className,
  ...rest
}: ToggleProps) {
  const dims =
    size === "sm"
      ? { w: 32, h: 18, knob: 14, pad: 2 }
      : { w: 40, h: 22, knob: 18, pad: 2 };
  const travel = dims.w - dims.knob - dims.pad * 2;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors shrink-0",
        checked ? "bg-accent" : "bg-line",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
      style={{ width: dims.w, height: dims.h, padding: dims.pad }}
      {...rest}
    >
      <span
        className="block rounded-full bg-white shadow-1 transition-transform"
        style={{
          width: dims.knob,
          height: dims.knob,
          transform: `translateX(${checked ? travel : 0}px)`,
        }}
      />
    </button>
  );
}
