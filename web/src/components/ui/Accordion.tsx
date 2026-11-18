"use client";

import * as React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";
import { motion } from "@/lib/motion";
import { usePresence } from "@/lib/use-presence";

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
  const body = usePresence(open, motion.collapse, { appear: false });
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
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-warm transition-colors duration-(--d-press) ease-out"
      >
        <span className="flex-1 min-w-0">{header}</span>
        <Icon
          name="chevron-d"
          size={18}
          className={cn(
            "text-ink-3 transition-transform duration-(--d-collapse) ease-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {body.rendered && (
        <div data-state={body.state} className="collapse-grid" inert={body.closing} aria-hidden={body.closing || undefined}>
          <div>
            <div className="border-t border-line-soft">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
