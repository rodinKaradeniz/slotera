"use client";

import * as React from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Notification } from "@/types/notification";

const TONE_ICON: Record<Notification["tone"], string> = {
  neutral: "bg-paper-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-accent-soft text-success",
  warning: "bg-[#F4E9D6] text-warning",
  danger: "bg-[#F2DDD8] text-danger",
  info: "bg-[#E1E7EE] text-info",
  ink: "bg-ink text-paper",
};

/** One notification, shared by the bell's dropdown and the notifications page. */
export function NotificationRow({
  item,
  onNavigate,
  compact = false,
}: {
  item: Notification;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
          TONE_ICON[item.tone],
        )}
        aria-hidden
      >
        <Icon name={item.icon as IconName} size={14} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={cn("block text-[13px] text-ink", item.unread && "font-medium")}>
          {item.title}
        </span>
        <span className={cn("block text-[12px] text-ink-3", compact && "truncate")}>{item.detail}</span>
      </span>
      <span className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-[11px] text-ink-3 tabular-nums">{item.age}</span>
        {item.unread && <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-label="Unread" />}
      </span>
    </>
  );
  const className = cn(
    "flex gap-3 px-4 py-3 border-b border-line-soft last:border-b-0 transition-colors duration-(--d-press) ease-out",
    item.unread && "bg-surface-warm",
  );
  return item.href ? (
    <Link href={item.href} onClick={onNavigate} className={cn(className, "hover:bg-paper-2")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
