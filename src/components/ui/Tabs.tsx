"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Tab = { value: string; label: string };

type TabsProps = {
  value: string;
  onChange: (next: string) => void;
  tabs: ReadonlyArray<Tab>;
  className?: string;
};

export function Tabs({ value, onChange, tabs, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 bg-paper-2 p-0.5 rounded-md border border-line",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "px-3 py-1.5 text-[13px] font-medium rounded-[5px] transition-colors",
              active
                ? "bg-surface text-ink shadow-1"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
