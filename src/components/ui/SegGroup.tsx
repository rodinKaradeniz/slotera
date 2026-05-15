"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<Option<T>>;
  size?: "sm" | "md";
  className?: string;
};

export function SegGroup<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center bg-paper-2 rounded-md p-0.5 border border-line",
        size === "sm" ? "h-8" : "h-10",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 rounded-[5px] text-[13px] font-medium h-full transition-all",
              active
                ? "bg-surface text-ink shadow-1"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
