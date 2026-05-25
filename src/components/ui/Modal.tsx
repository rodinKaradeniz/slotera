"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Optional. Omit for confirmation-style modals that need only title + footer. */
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  className,
}: ModalProps) {
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

  const hasBody =
    children !== undefined &&
    children !== null &&
    children !== false &&
    children !== true &&
    children !== "";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full bg-surface border border-line rounded-lg shadow-3 flex flex-col max-h-[88vh]",
          SIZES[size],
          className,
        )}
      >
        {(title || description) && (
          <div
            className={cn(
              "px-6 py-5 flex items-start gap-3",
              // Only draw the divider when there's a body below it. Confirm-style
              // modals (title + footer only) skip the line so they don't get a
              // floating rule with empty space underneath.
              hasBody && "border-b border-line-soft",
            )}
          >
            <div className="flex-1 min-w-0">
              {title && <h2 className="text-h3 text-ink">{title}</h2>}
              {description && (
                <p className="text-small mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-3 hover:text-ink p-1 -mr-1 -mt-1 rounded-md"
              aria-label="Close"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        {hasBody && (
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        )}
        {footer && (
          <div className="px-6 py-4 border-t border-line-soft flex justify-end gap-2 bg-surface-warm rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
