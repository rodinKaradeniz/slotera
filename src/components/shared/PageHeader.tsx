import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
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
  sub,
  actions,
  spacing = "default",
  className,
}: Props) {
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
        {sub && <p className="text-small text-ink-3 mt-2">{sub}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
