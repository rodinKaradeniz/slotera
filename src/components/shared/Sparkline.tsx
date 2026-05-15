import * as React from "react";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  showDot?: boolean;
  className?: string;
};

export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--accent)",
  fill = "var(--accent-soft)",
  showDot = true,
  className,
}: Props) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const pad = 2;
  const innerH = height - pad * 2;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return { x, y };
  });
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path d={area} fill={fill} opacity={0.6} />
      <path
        d={path}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot && (
        <circle cx={last.x} cy={last.y} r={2.5} fill={color} stroke="white" strokeWidth={1} />
      )}
    </svg>
  );
}
