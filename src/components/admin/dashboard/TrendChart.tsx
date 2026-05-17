"use client";

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
import { Card } from "@/components/ui/Card";
import { SegGroup } from "@/components/ui/SegGroup";
import { gbp } from "@/lib/money";
import type { TrendPoint } from "@/types/dashboard";

type Metric = "revenue" | "bookings";
type Props = { data: TrendPoint[] };

type TooltipPayload = {
  payload: TrendPoint;
  value: number;
};

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  const v = payload[0].value;
  return (
    <div className="bg-ink text-paper rounded-md shadow-3 px-3 py-2 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-paper/60 font-mono">
        Day {pt.d}
      </div>
      <div
        className="font-serif"
        style={{ fontSize: 18, fontWeight: 380, lineHeight: 1.15 }}
      >
        {metric === "revenue" ? gbp(v * 100) : `${v} bookings`}
      </div>
    </div>
  );
}

export function TrendChart({ data }: Props) {
  const [metric, setMetric] = React.useState<Metric>("revenue");

  return (
    <Card padded className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow">Last 30 days</div>
          <div
            className="font-serif text-ink mt-1"
            style={{ fontSize: 24, fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            {metric === "revenue" ? "Revenue trend" : "Bookings trend"}
          </div>
        </div>
        <SegGroup
          value={metric}
          onChange={(v) => setMetric(v)}
          options={[
            { value: "revenue", label: "Revenue" },
            { value: "bookings", label: "Bookings" },
          ]}
          size="sm"
        />
      </div>
      <div className="flex-1 w-full" style={{ minHeight: 220 }}>
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
              width={48}
              tick={{
                fill: "var(--ink-3)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
              tickFormatter={(v: number) =>
                metric === "revenue" ? `£${v}` : `${v}`
              }
            />
            <Tooltip
              cursor={{ stroke: "var(--line)", strokeDasharray: "2 4" }}
              content={<ChartTooltip metric={metric} />}
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
      </div>
    </Card>
  );
}
