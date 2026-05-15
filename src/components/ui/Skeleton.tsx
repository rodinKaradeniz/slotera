import * as React from "react";
import { cn } from "@/lib/cn";

type SkeletonProps = {
  w?: number | string;
  h?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

export function Skeleton({ w = "100%", h = 14, className, style }: SkeletonProps) {
  return (
    <span
      className={cn("block rounded-sm", className)}
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        background:
          "linear-gradient(90deg, var(--paper-2) 0%, var(--surface-warm) 50%, var(--paper-2) 100%)",
        backgroundSize: "800px 100%",
        animation: "slShimmer 1.4s linear infinite",
        ...style,
      }}
    />
  );
}
