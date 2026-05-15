import * as React from "react";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types/common";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2 border border-line",
  accent:  "bg-accent-soft text-accent-ink border border-[rgba(61,90,61,0.25)]",
  success: "bg-[#E7EDE3] text-success border border-[rgba(61,90,61,0.25)]",
  warning: "bg-[#F4E9D6] text-warning border border-[rgba(180,123,43,0.3)]",
  danger:  "bg-[#F2DDD8] text-danger border border-[rgba(163,59,42,0.3)]",
  info:    "bg-[#E1E7EE] text-info border border-[rgba(63,86,112,0.3)]",
  ink:     "bg-ink text-paper border border-ink",
};

type PillProps = {
  tone?: Tone;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
};

export function Pill({ tone = "neutral", icon, children, className }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
        TONE_STYLES[tone],
        className,
      )}
      style={{ letterSpacing: "0.01em" }}
    >
      {icon && <Icon name={icon} size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}
