"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useSlidingIndicator } from "@/lib/use-sliding-indicator";

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
  const { container, indicator } = useSlidingIndicator(value);
  return (
    <div
      ref={container}
      role="radiogroup"
      className={cn(
        "relative inline-flex items-center bg-paper-2 rounded-md p-0.5 border border-line",
        size === "sm" ? "h-8" : "h-10",
        className,
      )}
    >
      <span
        ref={indicator}
        aria-hidden
        data-ready="false"
        className="slide-indicator top-0.5 bottom-0.5 rounded-[5px] bg-surface shadow-1"
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "press relative px-3 rounded-[5px] text-[13px] font-medium h-full",
              active ? "text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
