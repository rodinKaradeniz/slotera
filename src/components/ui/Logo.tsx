import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  size?: number;
  withWord?: boolean;
  href?: string;
  className?: string;
};

export function Logo({ size = 22, withWord = true, href = "/", className }: LogoProps) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
      >
        <path
          d="M9 9 Q16 4 23 9 Q23 16 16 16 Q9 16 9 23 Q16 28 23 23"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="11" y="14.5" width="10" height="3" rx="1.2" fill="currentColor" />
      </svg>
      {withWord && (
        <span
          className="font-serif text-[20px] leading-none"
          style={{ letterSpacing: "-0.01em", fontWeight: 380 }}
        >
          Slotera
        </span>
      )}
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
