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
        background: "var(--paper-2)",
        // A slow breathe rather than a moving shine: loading should be calm, not busy.
        animation: "slBreathe 1.6s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
