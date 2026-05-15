import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

export function CardHead({ title, right, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-3.5 border-b border-line-soft bg-surface-warm rounded-t-lg",
        className,
      )}
    >
      <span className="font-serif text-ink flex-1" style={{ fontSize: 16 }}>
        {title}
      </span>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
