import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { Kpi } from "@/types/dashboard";
import { cn } from "@/lib/cn";

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const up = kpi.trend === "up";
  const down = kpi.trend === "down";
  return (
    <Card padded={false} className="h-full flex flex-col">
      <div className="px-5 py-4 flex-1 flex flex-col justify-center gap-1.5">
        <div className="eyebrow">{kpi.label}</div>
        <div
          className="font-serif text-ink"
          style={{
            fontSize: "clamp(26px, 2.6vw, 32px)",
            fontWeight: 380,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          {kpi.value}
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-1 text-[12px]",
            up && "text-success",
            down && "text-danger",
            !up && !down && "text-ink-3",
          )}
        >
          <Icon
            name={up ? "trend-up" : down ? "trend-down" : "dot"}
            size={12}
          />
          {kpi.delta}
          <span className="text-ink-3"> · vs last month</span>
        </div>
      </div>
    </Card>
  );
}
