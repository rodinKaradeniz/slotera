import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
};

export function Stat({ label, value, hint, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="eyebrow">{label}</span>
      <span
        className="font-serif text-ink"
        style={{ fontSize: 28, fontWeight: 380, lineHeight: 1.05 }}
      >
        {value}
      </span>
      {hint && <span className="text-small">{hint}</span>}
    </div>
  );
}
