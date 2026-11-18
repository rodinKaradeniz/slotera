"use client";
import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { Kpi } from "@/types/dashboard";
import { cn } from "@/lib/cn";
import { CountUp } from "@/components/shared/CountUp";
import { useI18n } from "@/components/i18n/I18nProvider";

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const up = kpi.trend === "up";
  const down = kpi.trend === "down";
  const { t } = useI18n();
  // "+12.4%" → "+12.4% vs last month"; anything that isn't a percentage is left out.
  const percent = /^[+−-]?\d+(?:[.,]\d+)?%$/.test(kpi.delta) ? kpi.delta.replace(/^[+−-]/, "") : null;
  const change = percent === null ? null
    : up ? t("dashboard.kpi.increase", { value: percent })
    : down ? t("dashboard.kpi.decrease", { value: percent })
    : t("dashboard.kpi.flat");
  return (
    <Card padded={false} className="h-full flex flex-col">
      <div className="px-5 py-4 flex-1 flex flex-col justify-center">
        <div
          className="font-serif text-ink"
          style={{
            fontSize: "clamp(26px, 2.6vw, 32px)",
            fontWeight: 380,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          <CountUp value={kpi.value} />
        </div>
        <div className="text-[13px] text-ink-2 mt-1.5">{kpi.label}</div>
        {change && <div
          className={cn(
            "flex items-start gap-1 text-[12px] leading-snug mt-1",
            up && "text-success",
            down && "text-danger",
            !up && !down && "text-ink-3",
          )}
        >
          <Icon
            name={up ? "trend-up" : down ? "trend-down" : "dot"}
            size={12}
            className="shrink-0 mt-[3px]"
          />
          {change}
        </div>}
      </div>
    </Card>
  );
}
