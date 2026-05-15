import * as React from "react";
import { avatarGradientFor, initialsOf } from "@/lib/avatar";
import { cn } from "@/lib/cn";

type AvatarProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Avatar({ name, size = 36, className }: AvatarProps) {
  const [from, to] = avatarGradientFor(name);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-medium text-ink-2 rounded-full select-none flex-shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
        background: `linear-gradient(135deg, ${from} 0%, ${to} 280%)`,
      }}
      aria-label={name}
    >
      {initialsOf(name)}
    </span>
  );
}
