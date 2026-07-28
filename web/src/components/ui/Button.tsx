"use client";

import * as React from "react";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "dark" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type Common = {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  full?: boolean;
  children?: React.ReactNode;
  className?: string;
};

type ButtonProps = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof Common>;

const SIZES: Record<Size, string> = {
  sm: "h-8 text-[13px] px-3",
  md: "h-10 text-[14px] px-4",
  lg: "h-12 text-[15px] px-5",
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover hover:-translate-y-px transition-all shadow-1",
  secondary:
    "bg-surface text-ink border border-line hover:border-ink-3 transition-colors",
  ghost:
    "bg-transparent text-ink hover:bg-[rgba(31,31,26,0.04)] transition-colors",
  dark:
    "bg-ink text-paper hover:bg-ink-2 transition-colors",
  outline:
    "bg-transparent text-ink border border-ink hover:bg-ink hover:text-paper transition-colors",
  danger:
    "bg-danger text-white hover:opacity-90 transition-opacity",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      icon,
      iconRight,
      loading,
      full,
      children,
      className,
      type = "button",
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium select-none",
          "disabled:opacity-60 disabled:pointer-events-none",
          SIZES[size],
          VARIANTS[variant],
          full && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1" aria-hidden>
            <span className="w-1 h-1 rounded-full bg-current animate-[slPulse_1s_ease-in-out_infinite]" />
            <span className="w-1 h-1 rounded-full bg-current animate-[slPulse_1s_ease-in-out_infinite_150ms]" />
            <span className="w-1 h-1 rounded-full bg-current animate-[slPulse_1s_ease-in-out_infinite_300ms]" />
          </span>
        ) : (
          <>
            {icon && <Icon name={icon} size={size === "lg" ? 18 : 16} />}
            {children}
            {iconRight && <Icon name={iconRight} size={size === "lg" ? 18 : 16} />}
          </>
        )}
      </button>
    );
  },
);
