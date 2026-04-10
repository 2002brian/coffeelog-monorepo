"use client";

import { Award, Bean, Sparkles, TrendingUp, Wrench } from "lucide-react";
import { type WidgetPayload, type WidgetStatus } from "@/lib/widgetData";

type WidgetCardProps = {
  payload: WidgetPayload;
  size: "small" | "medium";
};

type WidgetStatusCopy = {
  label: string;
  title: string;
  description: string;
  badgeClassName: string;
  icon: typeof Sparkles;
};

const STATUS_COPY: Record<WidgetStatus, WidgetStatusCopy> = {
  no_data: {
    label: "等待第一杯",
    title: "從第一杯開始",
    description: "新增第一筆沖煮後，Widget 會開始顯示每週節奏與風味之選。",
    badgeClassName: "bg-primary-default/12 text-primary-default",
    icon: Sparkles,
  },
  insufficient_data: {
    label: "慢慢累積",
    title: "先累積 3 杯以上",
    description: "先持續記錄幾杯，之後回頭看趨勢，會更容易找到自己的節奏。",
    badgeClassName: "bg-primary-default/12 text-primary-default",
    icon: Bean,
  },
  needs_tweak: {
    label: "風味探索中",
    title: "試著微調看看",
    description: "可先微調研磨度、水溫或粉水比，看看下一杯會帶來什麼新驚喜。",
    badgeClassName: "bg-status-error/12 text-status-error",
    icon: Wrench,
  },
  normal: {
    label: "穩穩沖煮",
    title: "節奏很順",
    description: "維持目前節奏，慢慢把喜歡的風味固定下來。",
    badgeClassName: "bg-primary-default/12 text-primary-default",
    icon: TrendingUp,
  },
  hall_of_fame: {
    label: "今日驚喜",
    title: "最近出現一杯值得記住的好味道",
    description: "這杯很適合收進常用參數，作為下次快速帶入的起點。",
    badgeClassName: "bg-status-success/12 text-status-success",
    icon: Award,
  },
};

function formatScore(value: number | null) {
  if (value === null) {
    return "0.0";
  }

  return value.toFixed(1);
}

function formatUpdatedAt(value: number | null) {
  if (value === null) {
    return "尚未建立資料";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function buildSmallSummary(payload: WidgetPayload) {
  switch (payload.status) {
    case "no_data":
      return {
        primaryValue: "0",
        primaryLabel: "本週沖煮",
        secondaryLabel: "平均分",
        secondaryValue: "尚無資料",
      };
    case "insufficient_data":
      return {
        primaryValue: String(payload.totalCups),
        primaryLabel: "已記錄杯數",
        secondaryLabel: "解鎖完整分析",
        secondaryValue: `再 ${Math.max(0, 3 - payload.totalCups)} 杯`,
      };
    case "needs_tweak":
      return {
        primaryValue: formatScore(payload.recentAverageScore),
        primaryLabel: "最近 3 杯",
        secondaryLabel: "本週杯數",
        secondaryValue: `${payload.weekCups} 杯`,
      };
    case "hall_of_fame":
      return {
        primaryValue: formatScore(payload.bestRecipe?.score ?? payload.latestScore),
        primaryLabel: "最佳分數",
        secondaryLabel: "本週平均",
        secondaryValue: formatScore(payload.weekAverageScore),
      };
    case "normal":
    default:
      return {
        primaryValue: String(payload.weekCups),
        primaryLabel: "本週沖煮",
        secondaryLabel: "平均分",
        secondaryValue: formatScore(payload.weekAverageScore),
      };
  }
}

function TrendBars({ payload }: { payload: WidgetPayload }) {
  return (
    <div className="flex h-full min-h-0 items-end gap-1.5 overflow-hidden">
      {payload.trend.map((point) => {
        const height = point.score === null ? 18 : 18 + (point.score / 5) * 42;

        return (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-full ${
                point.score === null ? "bg-border-subtle" : "bg-primary-default/80"
              }`}
              style={{ height: `${height}px` }}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}

function SmallWidgetCard({ payload }: { payload: WidgetPayload }) {
  const state = STATUS_COPY[payload.status];
  const Icon = state.icon;
  const summary = buildSmallSummary(payload);

  return (
    <article className="relative flex h-[160px] w-[160px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-border-subtle bg-dark-panel p-4 shadow-sm transition-colors duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${state.badgeClassName}`}>
          <Icon className="h-3.5 w-3.5" />
          <span>{state.label}</span>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          {summary.primaryLabel}
        </p>
        <p className="mt-2 truncate text-5xl font-bold tracking-tight text-text-primary">
          {summary.primaryValue}
        </p>
      </div>

      <div className="mt-auto space-y-2">
        <div className="rounded-[1.15rem] border border-border-subtle bg-dark-control px-3 py-2.5">
          <p className="text-[11px] font-medium text-text-secondary">{summary.secondaryLabel}</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{summary.secondaryValue}</p>
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-text-secondary">{state.title}</p>
      </div>
    </article>
  );
}

function MediumWidgetCard({ payload }: { payload: WidgetPayload }) {
  const state = STATUS_COPY[payload.status];
  const Icon = state.icon;

  return (
    <article className="relative h-[160px] w-[338px] shrink-0 overflow-hidden rounded-[22px] border border-border-subtle bg-dark-panel shadow-sm transition-colors duration-200">
      <div className="grid h-full grid-cols-2 gap-4 p-4">
        <section className="flex min-w-0 min-h-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                本週趨勢
              </p>
              <p className="mt-1 truncate text-2xl font-bold tracking-tight text-text-primary">
                {payload.weekCups}
                <span className="ml-1 text-sm font-semibold text-text-secondary">杯</span>
              </p>
            </div>
            <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${state.badgeClassName}`}>
              <Icon className="h-3.5 w-3.5" />
              <span>{state.label}</span>
            </div>
          </div>

          <div className="mt-3 flex-1 min-h-0">
            <TrendBars payload={payload} />
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-text-secondary">本週平均</p>
              <p className="mt-1 text-base font-semibold text-text-primary">
                {formatScore(payload.weekAverageScore)}
              </p>
            </div>
            <p className="line-clamp-2 min-w-0 text-right text-[11px] leading-5 text-text-secondary">
              {state.description}
            </p>
          </div>
        </section>

        <section className="flex min-w-0 min-h-0 flex-col rounded-[18px] border border-border-subtle bg-dark-control px-3.5 py-3 transition-colors duration-200">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            風味之選
          </p>

          {payload.bestRecipe ? (
            <>
              <div className="mt-3 min-w-0">
                <p className="truncate text-base font-semibold text-text-primary">
                  {payload.bestRecipe.beanName}
                </p>
                <p className="mt-1 truncate text-xs leading-5 text-text-secondary">
                  {payload.bestRecipe.equipmentName}
                </p>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-text-secondary">分數</p>
                  <p
                    className={`mt-1 text-2xl font-bold tracking-tight ${
                      payload.status === "needs_tweak"
                        ? "text-status-error"
                        : payload.status === "hall_of_fame"
                          ? "text-status-success"
                          : "text-text-primary"
                    }`}
                  >
                    {formatScore(payload.bestRecipe.score)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-medium text-text-secondary">粉水比</p>
                  <p className="mt-1 truncate text-sm font-semibold text-text-primary">
                    {payload.bestRecipe.ratio}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-auto rounded-[1rem] border border-dashed border-border-subtle px-3 py-4 text-sm leading-6 text-text-secondary">
              先多記錄幾杯，這裡會慢慢浮現值得留下的風味之選。
            </div>
          )}

          <p className="mt-auto truncate pt-3 text-[11px] leading-5 text-text-secondary">
            更新於 {formatUpdatedAt(payload.updatedAt)}
          </p>
        </section>
      </div>
    </article>
  );
}

export function WidgetCard({ payload, size }: WidgetCardProps) {
  if (size === "small") {
    return <SmallWidgetCard payload={payload} />;
  }

  return <MediumWidgetCard payload={payload} />;
}
