import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Short product description sentence, sits directly below the title. */
  description?: React.ReactNode;
  /** Muted aggregate stats line, e.g. "24 bookings · 3 pending payment". */
  meta?: React.ReactNode;
  /** Legacy slot — kept as an alias for `meta` so existing call sites keep working. */
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  /** Default mb is 10 (40px). "tight" for nested headers. */
  spacing?: "tight" | "default";
  className?: string;
};

const SPACING: Record<NonNullable<Props["spacing"]>, string> = {
  tight: "mb-6",
  default: "mb-10",
};

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  sub,
  actions,
  spacing = "default",
  className,
}: Props) {
  const metaNode = meta ?? sub;
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        SPACING[spacing],
        className,
      )}
    >
      <div className="min-w-0 flex flex-col">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="text-h1 text-ink">{title}</h1>
        {description && (
          <p className="text-body text-ink-2 mt-3 max-w-[60ch]">{description}</p>
        )}
        {metaNode && (
          <p className="text-small text-ink-3 mt-2">{metaNode}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
