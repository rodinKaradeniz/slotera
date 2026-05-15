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
      ? { w: 32, h: 18, knob: 14 }
      : { w: 40, h: 22, knob: 18 };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors flex-shrink-0",
        checked ? "bg-accent" : "bg-line",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
      style={{ width: dims.w, height: dims.h }}
      {...rest}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-1 transition-transform"
        style={{
          width: dims.knob,
          height: dims.knob,
          left: 2,
          transform: `translateY(-50%) translateX(${
            checked ? dims.w - dims.knob - 4 : 0
          }px)`,
        }}
      />
    </button>
  );
}
