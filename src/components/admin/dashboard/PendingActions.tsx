"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { CardHead } from "@/components/shared/CardHead";
import type { PendingAction } from "@/types/dashboard";
import { cn } from "@/lib/cn";

type Props = { items: PendingAction[] };

export function PendingActions({ items }: Props) {
  const [list, setList] = React.useState(items);
  return (
    <Card padded={false}>
      <CardHead
        title="Needs attention"
        right={
          <button
            type="button"
            onClick={() => setList([...items])}
            aria-label="Refresh"
            className="text-ink-3 hover:text-ink w-7 h-7 rounded-md flex items-center justify-center"
          >
            <Icon name="refresh" size={14} />
          </button>
        }
      />
      <div>
        {list.length === 0 && (
          <div className="px-5 py-6 text-small text-center">All caught up.</div>
        )}
        {list.map((p) => (
          <div
            key={p.id}
            className="flex items-start gap-3 px-5 py-3.5 border-b border-line-soft last:border-b-0"
          >
            <span
              className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
                p.tone === "warning" && "bg-[#F4E9D6] text-warning",
                p.tone === "info" && "bg-[#E1E7EE] text-info",
                p.tone === "danger" && "bg-[#F2DDD8] text-danger",
                p.tone === "accent" && "bg-accent-soft text-accent",
                (p.tone === "neutral" || !["warning","info","danger","accent"].includes(p.tone)) &&
                  "bg-paper-2 text-ink-2",
              )}
            >
              <Icon name={p.icon} size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-ink">{p.label}</div>
              <div className="text-small truncate">{p.detail}</div>
            </div>
            <div className="text-micro text-ink-3 flex-shrink-0">{p.age}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
