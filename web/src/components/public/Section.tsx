import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
};

export function Section({
  children,
  className,
  containerClassName,
  ...rest
}: Props) {
  return (
    <section className={cn("py-16 sm:py-24", className)} {...rest}>
      <div
        className={cn(
          "max-w-[1200px] mx-auto px-6",
          containerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
