import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, sub, actions, className }: Props) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1
          className="font-serif text-ink"
          style={{
            fontSize: "clamp(28px, 3vw, 40px)",
            fontWeight: 380,
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          {title}
        </h1>
        {sub && <p className="text-small text-ink-3 mt-1">{sub}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
