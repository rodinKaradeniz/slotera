"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { SegGroup } from "@/components/ui/SegGroup";
import { eur } from "@/lib/money";
import type { TrendPoint } from "@/types/dashboard";

type Metric = "revenue" | "bookings";

type Props = { data: TrendPoint[] };

export function TrendChart({ data }: Props) {
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const [hover, setHover] = React.useState<{ x: number; y: number; pt: TrendPoint } | null>(
    null,
  );

  const width = 560;
  const height = 200;
  const padX = 14;
  const padY = 18;

  const values = data.map((d) => (metric === "revenue" ? d.revenue : d.bookings));
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;
  const stepX =
    data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const v = metric === "revenue" ? d.revenue : d.bookings;
    return {
      x: padX + i * stepX,
      y: padY + (height - padY * 2) * (1 - (v - min) / range),
      pt: d,
    };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const formatValue = (v: number) =>
    metric === "revenue" ? eur(v * 100) : `${v} bookings`;

  return (
    <Card padded className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="eyebrow">Last 30 days</div>
          <div
            className="font-serif text-ink mt-1"
            style={{ fontSize: 22, fontWeight: 400 }}
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
      <div className="relative">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
        >
          <line
            x1={padX}
            x2={width - padX}
            y1={padY}
            y2={padY}
            stroke="var(--line-soft)"
            strokeDasharray="2 4"
          />
          <line
            x1={padX}
            x2={width - padX}
            y1={padY + (height - padY * 2) / 2}
            y2={padY + (height - padY * 2) / 2}
            stroke="var(--line-soft)"
            strokeDasharray="2 4"
          />
          <line
            x1={padX}
            x2={width - padX}
            y1={height - padY}
            y2={height - padY}
            stroke="var(--line-soft)"
          />
          <path
            d={`${path} L ${points[points.length - 1].x} ${height - padY} L ${padX} ${height - padY} Z`}
            fill="var(--accent-soft)"
            opacity={0.55}
          />
          <path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hover?.pt.d === p.pt.d ? 4 : 2.2}
              fill="var(--accent)"
              stroke="#fff"
              strokeWidth={hover?.pt.d === p.pt.d ? 2 : 0.5}
              onMouseEnter={() => setHover({ x: p.x, y: p.y, pt: p.pt })}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>
        {hover && (
          <div
            className="absolute pointer-events-none bg-ink text-paper rounded-md shadow-3 px-3 py-2"
            style={{
              left: `calc(${(hover.x / width) * 100}% - 74px)`,
              top: `${(hover.y / height) * 100}% - 70px`,
              width: 148,
            }}
          >
            <div className="text-[10px] uppercase tracking-wider text-paper/60 font-mono">
              Day {hover.pt.d}
            </div>
            <div
              className="font-serif"
              style={{ fontSize: 18, fontWeight: 380, lineHeight: 1.1 }}
            >
              {formatValue(metric === "revenue" ? hover.pt.revenue : hover.pt.bookings)}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
