"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import { SegGroup } from "@/components/ui/SegGroup";
import type { Currency } from "@/types/common";
import type { TrendPoint } from "@/types/dashboard";
import type { Metric } from "./TrendPlot";

// Recharts is about a fifth of the dashboard's JavaScript, so the plot loads on its own
// while the card, title and switch render straight away; its box keeps the space.
const TrendPlot = dynamic(() => import("./TrendPlot"), { ssr: false });

type Props = { data: TrendPoint[]; currency?: Currency };

export function TrendChart({ data, currency = "GBP" }: Props) {
  const { t: uiText } = useI18n();
  const [metric, setMetric] = React.useState<Metric>("revenue");
  // Recharts' ResponsiveContainer falls back to width(-1)/height(-1) when its
  // parent is briefly detached or zero-sized during a Next.js route transition,
  // which prints a noisy console warning. Gate the chart on a measured positive
  // size so it only mounts once the container has real dimensions.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measured = size.w > 0 && size.h > 0;

  return (
    <Card padded className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow">{uiText("ui.last.30.days")}</div>
          <div
            className="font-serif text-ink mt-1"
            style={{ fontSize: 24, fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            {metric === "revenue" ? uiText("ui.revenue.trend") : uiText("ui.bookings.trend")}
          </div>
        </div>
        <SegGroup
          value={metric}
          onChange={(v) => setMetric(v)}
          options={[
            { value: "revenue", label: uiText("ui.revenue") },
            { value: "bookings", label: uiText("ui.bookings") },
          ]}
          size="sm"
        />
      </div>
      <div
        ref={containerRef}
        className="flex-1 w-full"
        style={{ minHeight: 220 }}
      >
        {measured && (
        <TrendPlot data={data} metric={metric} currency={currency} />
        )}
      </div>
    </Card>
  );
}
