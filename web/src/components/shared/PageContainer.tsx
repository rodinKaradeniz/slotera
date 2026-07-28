import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Override the default max-width. Defaults to 1200px which fits dashboards.
   *  Use "narrow" (820px) for detail pages, "wide" (1400px) for the calendar. */
  width?: "narrow" | "default" | "wide";
};

const WIDTH_CLASS: Record<NonNullable<Props["width"]>, string> = {
  narrow: "max-w-[820px]",
  default: "max-w-[1200px]",
  wide: "max-w-[1400px]",
};

export function PageContainer({
  width = "default",
  className,
  children,
  ...rest
}: Props) {
  return (
    <div
      className={cn("mx-auto w-full", WIDTH_CLASS[width], className)}
      {...rest}
    >
      {children}
    </div>
  );
}
