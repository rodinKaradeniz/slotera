"use client";

import * as React from "react";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/cn";

type Common = {
  icon?: IconName;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: boolean;
  className?: string;
};

type InputProps = Common &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof Common>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ icon, prefix, suffix, error, className, ...rest }, ref) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 h-11 px-3 bg-surface border rounded-md transition-colors",
          error ? "border-danger" : "border-line focus-within:border-ink-3",
          className,
        )}
      >
        {icon && <Icon name={icon} size={16} className="text-ink-3" />}
        {prefix && <span className="text-ink-3 text-[13px]">{prefix}</span>}
        <input
          ref={ref}
          className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-4"
          {...rest}
        />
        {suffix && <span className="text-ink-3 text-[13px]">{suffix}</span>}
      </div>
    );
  },
);
