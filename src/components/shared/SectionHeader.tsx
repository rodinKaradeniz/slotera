import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Default mb is 10 (40px). Set "tight" for inner sections (mb-6 = 24px). */
  spacing?: "tight" | "default" | "loose";
  align?: "start" | "center";
  /** Right-aligned slot, e.g. a tab toggle. */
  right?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  /** Cap the title width — useful for marketing sections. */
  maxTitleWidth?: string;
};

const SPACING: Record<NonNullable<Props["spacing"]>, string> = {
  tight: "mb-6",
  default: "mb-10",
  loose: "mb-14",
};

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  spacing = "default",
  align = "start",
  right,
  className,
  titleClassName,
  maxTitleWidth,
}: Props) {
  const aligned = align === "center" ? "text-center items-center" : "items-start";
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        SPACING[spacing],
        className,
      )}
    >
      <div className={cn("flex flex-col", aligned)}>
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h2
          className={cn("text-h1 text-ink", titleClassName)}
          style={maxTitleWidth ? { maxWidth: maxTitleWidth } : undefined}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-body-lg mt-3 text-ink-3"
            style={maxTitleWidth ? { maxWidth: maxTitleWidth } : undefined}
          >
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
