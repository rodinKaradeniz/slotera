"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import type { Currency } from "@/types/common";
import type { TrendPoint } from "@/types/dashboard";

/** The Recharts plot, split from `TrendChart` so the library loads after the dashboard. */
export type Metric = "revenue" | "bookings";

type TooltipPayload = {
  payload: TrendPoint;
  value: number;
};

function ChartTooltip({
  active,
  payload,
  metric,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  metric: Metric;
  currency: Currency;
}) {
  const { t: uiText } = useI18n();
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  const v = payload[0].value;
  return (
    <div className="bg-ink text-paper rounded-md shadow-3 px-3 py-2 min-w-[140px]">
      <div className="text-[11px] text-paper/60">
        {uiText("ui.day")}{pt.d}
      </div>
      <div
        className="font-serif"
        style={{ fontSize: 18, fontWeight: 380, lineHeight: 1.15 }}
      >
        {metric === "revenue" ? formatMoney(v * 100, currency) : `${v} bookings`}
      </div>
    </div>
  );
}

export default function TrendPlot({
  data,
  metric,
  currency,
}: {
  data: TrendPoint[];
  metric: Metric;
  currency: Currency;
}) {
  return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--line-soft)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="d"
            tickLine={false}
            axisLine={{ stroke: "var(--line-soft)" }}
            tick={{
              fill: "var(--ink-3)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
            interval={4}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{
              fill: "var(--ink-3)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
            // Compact amounts ("£1k"): full ones ("£1,000.00") were cut off by the axis.
            tickFormatter={(v: number) =>
              metric === "revenue" ? formatMoneyCompact(v * 100, currency) : `${v}`
            }
          />
          <Tooltip
            cursor={{ stroke: "var(--line)", strokeDasharray: "2 4" }}
            content={<ChartTooltip metric={metric} currency={currency} />}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="var(--accent)"
            strokeWidth={1.8}
            fill="url(#trendFill)"
            activeDot={{
              r: 4,
              stroke: "#fff",
              strokeWidth: 2,
              fill: "var(--accent)",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
  );
}
