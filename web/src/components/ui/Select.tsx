"use client";

import * as React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type Option = { value: string; label: string };
type Common = {
  options: ReadonlyArray<Option | string>;
  error?: boolean;
  className?: string;
};
type SelectProps = Common &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, keyof Common>;

function normalize(opt: Option | string): Option {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ options, error, className, ...rest }, ref) {
    return (
      <div
        className={cn(
          "relative h-11 flex items-center bg-surface border rounded-md transition-colors",
          error ? "border-danger" : "border-line focus-within:border-ink-3",
          className,
        )}
      >
        <select
          ref={ref}
          className="flex-1 appearance-none bg-transparent outline-none text-[14px] text-ink px-3 pr-9 h-full"
          {...rest}
        >
          {options.map((o) => {
            const n = normalize(o);
            return (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            );
          })}
        </select>
        <Icon
          name="chevron-d"
          size={16}
          className="absolute right-3 pointer-events-none text-ink-3"
        />
      </div>
    );
  },
);
