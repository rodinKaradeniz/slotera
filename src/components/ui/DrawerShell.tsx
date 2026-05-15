"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function DrawerShell({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  className,
}: DrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.classList.add("scroll-locked");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("scroll-locked");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute bg-surface border-line shadow-3 flex flex-col fade-in",
          "right-0 top-0 h-full w-full sm:max-w-[480px] border-l",
          "max-sm:top-auto max-sm:bottom-0 max-sm:h-[92vh] max-sm:rounded-t-lg max-sm:border-l-0 max-sm:border-t",
          className,
        )}
      >
        <div className="px-6 py-4 border-b border-line-soft flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {eyebrow && (
              <div className="eyebrow mb-1.5">{eyebrow}</div>
            )}
            <h2 className="h-3 text-ink truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 hover:text-ink p-1 rounded-md flex-shrink-0"
            aria-label="Close"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-line-soft flex justify-end gap-2 bg-surface-warm">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
