"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { BookingThemeContext } from "@/components/booking/BookingTheme";
import { useHydrated } from "@/lib/use-hydrated";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional. Omit for confirmation-style modals that need only title + footer. */
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
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
  const { t: uiText } = useI18n();
  const theme = React.useContext(BookingThemeContext);
  const mounted = useHydrated();
  useScrollLock(open);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useDialogFocus(open && mounted, dialogRef);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dialogRef.current?.contains(document.activeElement)) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
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
      style={theme}
      ref={dialogRef}
      tabIndex={-1}
      className="booking-theme fixed inset-0 z-50 flex items-center justify-center p-4 fade-in outline-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
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
              {title && (
                <h2 id={titleId} className="text-h3 text-ink">
                  {title}
                </h2>
              )}
              {description && (
                <div className="text-small mt-1">{description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-3 hover:text-ink p-1 -mr-1 -mt-1 rounded-md"
              aria-label={uiText("ui.close")}
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        {hasBody && (
          <ScrollArea contentClassName="px-6 py-5">{children}</ScrollArea>
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
