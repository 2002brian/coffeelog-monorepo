"use client";

import { type EquipmentLeaderboardData } from "@/lib/analytics";

function EmptyState({ state }: { state: EquipmentLeaderboardData["state"] }) {
  const message =
    state === "insufficient_data"
      ? "再累積幾杯器具紀錄，解鎖器具表現排行榜"
      : "再多累積幾杯，器具之間的手感差異就會更清楚";

  return (
    <div className="rounded-2xl border border-border-subtle bg-dark-control px-4 py-4 shadow-sm transition-colors duration-200">
      <div>
        <p className="text-[11px] font-semibold text-text-secondary">器具表現</p>
        <h3 className="mt-1 text-sm font-semibold text-text-primary">排行榜</h3>
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-dark-panel px-4 py-8 text-center">
        <p className="text-sm leading-6 text-text-secondary">{message}</p>
      </div>
    </div>
  );
}

export default function EquipmentLeaderboard({
  data,
}: {
  data: EquipmentLeaderboardData;
}) {
  if (data.state !== "ready") {
    return <EmptyState state={data.state} />;
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-dark-control px-4 py-4 shadow-sm transition-colors duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-text-secondary">器具手感</p>
          <h3 className="mt-1 text-sm font-semibold text-text-primary">排行榜</h3>
        </div>
        <p className="text-xs text-text-secondary">只顯示樣本數 ≥ 2</p>
      </div>

      <div className="mt-4 space-y-3">
        {data.items.map((item, index) => {
          const width = Math.max(12, Math.min(100, (item.averageRating / 5) * 100));

          return (
            <div
              key={item.equipmentName}
              className="rounded-xl border border-border-subtle bg-dark-panel px-3 py-3 transition-colors duration-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {index + 1}. {item.equipmentName}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">n={item.sampleCount}</p>
                </div>
                <p className="tabular-nums text-sm font-semibold text-text-primary">
                  {item.averageRating.toFixed(1)}
                </p>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-dark-base">
                <div
                  className="h-full rounded-full bg-cta-primary transition-[width] duration-300"
                  style={{
                    width: `${width}%`,
                    boxShadow: "0 0 12px color-mix(in srgb, var(--cta-primary) 42%, transparent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
