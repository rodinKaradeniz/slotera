"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useSlidingIndicator } from "@/lib/use-sliding-indicator";

type Tab = { value: string; label: string };

type TabsProps = {
  value: string;
  onChange: (next: string) => void;
  tabs: ReadonlyArray<Tab>;
  className?: string;
};

export function Tabs({ value, onChange, tabs, className }: TabsProps) {
  const { container, indicator } = useSlidingIndicator(value);
  return (
    <div
      ref={container}
      role="tablist"
      className={cn(
        "relative inline-flex items-center gap-1 bg-paper-2 p-0.5 rounded-md border border-line",
        className,
      )}
    >
      <span
        ref={indicator}
        aria-hidden
        data-ready="false"
        className="slide-indicator top-0.5 bottom-0.5 rounded-[5px] bg-surface shadow-1"
      />
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "press relative px-3 py-1.5 text-[13px] font-medium rounded-[5px]",
              active ? "text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The content under a tab list. Each change of `value` cross-fades the new panel in with
 * a short slide from the side of the tab chosen (left of the old one → from the left).
 */
export function TabPanel({
  value,
  order,
  className,
  children,
}: {
  value: string;
  /** Tab values in display order, to know which way to slide. */
  order: ReadonlyArray<string>;
  className?: string;
  children: React.ReactNode;
}) {
  const [prev, setPrev] = React.useState(value);
  const [direction, setDirection] = React.useState(0);
  if (value !== prev) {
    setPrev(value);
    setDirection(Math.sign(order.indexOf(value) - order.indexOf(prev)));
  }
  return (
    <div
      key={value}
      // No slide on first render: the screen's own entrance covers that.
      className={cn(direction !== 0 && "tab-panel", className)}
      style={{ "--shift": `calc(var(--shift-tab) * ${direction})` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
