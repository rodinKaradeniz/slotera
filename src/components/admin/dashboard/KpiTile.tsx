import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Sparkline } from "@/components/shared/Sparkline";
import type { Kpi } from "@/types/dashboard";
import { cn } from "@/lib/cn";

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const up = kpi.trend === "up";
  const down = kpi.trend === "down";
  return (
    <Card padded={false} className="flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <div className="eyebrow">{kpi.label}</div>
        <div
          className="font-serif text-ink mt-2"
          style={{
            fontSize: "clamp(28px, 3vw, 36px)",
            fontWeight: 380,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          {kpi.value}
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-1 text-[12px] mt-2",
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
      <div className="bg-surface-warm px-2 pt-1 pb-1 mt-auto rounded-b-lg" style={{ height: 54 }}>
        <Sparkline data={kpi.spark} height={46} />
      </div>
    </Card>
  );
}
