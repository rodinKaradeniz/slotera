"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Common = { error?: boolean; className?: string };
type TextareaProps = Common &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, keyof Common>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ error, className, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full px-3 py-2.5 bg-surface border rounded-md text-[14px] text-ink outline-none",
          "placeholder:text-ink-4 resize-y",
          error ? "border-danger" : "border-line focus:border-ink-3",
          className,
        )}
        {...rest}
      />
    );
  },
);
