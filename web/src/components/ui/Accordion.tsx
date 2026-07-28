"use client";

import * as React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type AccordionItemProps = {
  open: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function AccordionItem({
  open,
  onToggle,
  header,
  children,
  className,
}: AccordionItemProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-lg shadow-1 overflow-hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-warm transition-colors"
      >
        <span className="flex-1 min-w-0">{header}</span>
        <Icon
          name="chevron-d"
          size={18}
          className={cn(
            "text-ink-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-line-soft fade-in">{children}</div>
      )}
    </div>
  );
}
