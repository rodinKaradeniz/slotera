import * as React from "react";
import { cn } from "@/lib/cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  hover?: boolean;
  selected?: boolean;
  as?: React.ElementType;
};

export function Card({
  className,
  padded = true,
  hover,
  selected,
  as: Tag = "div",
  ...rest
}: CardProps) {
  return (
    <Tag
      data-selected={selected || undefined}
      className={cn(
        "bg-surface border rounded-lg shadow-1",
        selected ? "border-accent" : "border-line",
        padded && "p-7",
        hover &&
          "transition-all duration-200 hover:-translate-y-px hover:shadow-2 hover:border-ink-4",
        className,
      )}
      {...rest}
    />
  );
}
