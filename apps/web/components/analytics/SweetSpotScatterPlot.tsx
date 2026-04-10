"use client";

import { useId } from "react";
import { type SweetSpotScatterData } from "@/lib/analytics";

function EmptyState({ state }: { state: SweetSpotScatterData["state"] }) {
  const message =
    state === "insufficient_data"
      ? "紀錄更多沖煮參數，解鎖風味甜蜜點分析"
      : "再多記下幾次研磨與水溫，甜蜜點就會慢慢浮現";

  return (
    <div className="rounded-2xl border border-border-subtle bg-dark-control px-4 py-4 shadow-sm transition-colors duration-200">
      <div>
        <p className="text-[11px] font-semibold text-text-secondary">風味甜蜜點</p>
        <h3 className="mt-1 text-sm font-semibold text-text-primary">研磨度 × 水溫</h3>
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-dark-panel px-4 py-8 text-center">
        <p className="text-sm leading-6 text-text-secondary">{message}</p>
      </div>
    </div>
  );
}

export default function SweetSpotScatterPlot({
  data,
}: {
  data: SweetSpotScatterData;
}) {
  if (data.state !== "ready") {
    return <EmptyState state={data.state} />;
  }

  const gradientId = useId();
  const glowId = useId();
  const width = 340;
  const height = 220;
  const padding = { top: 18, right: 16, bottom: 36, left: 34 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xSpan = data.xDomain.max - data.xDomain.min || 1;
  const ySpan = data.yDomain.max - data.yDomain.min || 1;

  const points = data.points.map((point) => {
    const x =
      padding.left + ((point.x - data.xDomain.min) / xSpan) * innerWidth;
    const y =
      padding.top +
      innerHeight -
      ((point.y - data.yDomain.min) / ySpan) * innerHeight;
    const radius = 4.5 + ((point.rating - 1) / 4) * 5.5;
    const opacity = 0.35 + ((point.rating - 1) / 4) * 0.55;

    return { ...point, x, y, radius, opacity };
  });

  const xTicks = Array.from({ length: 4 }, (_, index) => {
    const value = data.xDomain.min + (xSpan / 3) * index;
    return {
      value,
      label: value.toFixed(1),
      x: padding.left + (innerWidth / 3) * index,
    };
  });
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const value = data.yDomain.min + (ySpan / 3) * index;
    return {
      value,
      label: `${value.toFixed(1)}°`,
      y: padding.top + innerHeight - (innerHeight / 3) * index,
    };
  });

  return (
    <div className="rounded-2xl border border-border-subtle bg-dark-control px-4 py-4 shadow-sm transition-colors duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-text-secondary">風味甜蜜點</p>
          <h3 className="mt-1 text-sm font-semibold text-text-primary">研磨度 × 水溫</h3>
        </div>
        <p className="text-xs text-text-secondary">分數越高，光點越明亮</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border-subtle bg-dark-panel transition-colors duration-200">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
          <defs>
            <radialGradient id={gradientId}>
              <stop offset="0%" stopColor="var(--cta-primary)" stopOpacity="0.92" />
              <stop offset="100%" stopColor="var(--cta-primary)" stopOpacity="0" />
            </radialGradient>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {xTicks.map((tick) => (
            <g key={`x-${tick.label}`}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={padding.top}
                y2={padding.top + innerHeight}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
              <text
                x={tick.x}
                y={height - 12}
                textAnchor="middle"
                fontSize="10"
                fill="var(--chart-axis)"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {yTicks.map((tick) => (
            <g key={`y-${tick.label}`}>
              <line
                x1={padding.left}
                x2={padding.left + innerWidth}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={tick.y + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--chart-axis)"
              >
                {tick.label}
              </text>
            </g>
          ))}

          <text
            x={width / 2}
            y={height - 2}
            textAnchor="middle"
            fontSize="10"
            fill="var(--chart-axis)"
          >
            研磨度
          </text>
          <text
            x={14}
            y={height / 2}
            textAnchor="middle"
            fontSize="10"
            fill="var(--chart-axis)"
            transform={`rotate(-90 14 ${height / 2})`}
          >
            水溫
          </text>

          {points.map((point) => (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={point.radius * 1.8}
                fill={`url(#${gradientId})`}
                opacity={point.opacity}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={point.radius}
                fill="var(--cta-primary)"
                opacity={point.opacity}
                filter={`url(#${glowId})`}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={Math.max(1.8, point.radius * 0.38)}
                fill="var(--chart-dot-core)"
                opacity={Math.min(0.95, point.opacity + 0.12)}
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
