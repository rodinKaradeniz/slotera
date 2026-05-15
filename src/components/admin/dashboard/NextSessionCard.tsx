"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { CardHead } from "@/components/shared/CardHead";
import { SERVICE_STYLE } from "@/lib/status-maps";
import type { DashboardScheduleItem } from "@/types/dashboard";

type Props = { item?: DashboardScheduleItem };

export function NextSessionCard({ item }: Props) {
  if (!item) {
    return (
      <Card padded className="text-small text-ink-3">No upcoming sessions today.</Card>
    );
  }
  const style = SERVICE_STYLE[item.kind];
  return (
    <Card padded={false}>
      <CardHead
        title="Next session"
        right={<Pill tone="accent" icon="clock">in 2h 14m</Pill>}
      />
      <div className="px-5 py-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-serif text-ink" style={{ fontSize: 28, fontWeight: 380 }}>
              {item.time}
              <span className="text-ink-3 text-[16px] font-sans"> · {item.duration}</span>
            </div>
            <div className="mt-2 text-[15px] text-ink">
              {item.client}
              {item.company && <span className="text-ink-3"> · {item.company}</span>}
            </div>
          </div>
          <span
            className="px-2 py-1 rounded-md text-[12px] font-medium"
            style={{ background: style.bg, color: style.fg }}
          >
            {style.label}
          </span>
        </div>
        {item.notes && (
          <p className="text-small mt-3 italic">&ldquo;{item.notes}&rdquo;</p>
        )}
        <div className="flex flex-wrap gap-2 mt-5">
          <Button variant="primary" size="sm" icon="video">Join meeting</Button>
          <Button variant="secondary" size="sm" icon="copy">Copy link</Button>
          <Button variant="ghost" size="sm" icon="refresh">Reschedule</Button>
        </div>
      </div>
    </Card>
  );
}
