"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bean,
  ChartColumn,
  Droplets,
  FlaskConical,
  HelpCircle,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import EquipmentLeaderboard from "@/components/analytics/EquipmentLeaderboard";
import SweetSpotScatterPlot from "@/components/analytics/SweetSpotScatterPlot";
import { getActiveAnalyticsRecords } from "@/hooks/useBrewData";
import {
  buildAnalyticsSnapshot,
  formatDateInputValue,
  type AnalyticsRange,
  type AnalyticsRecord,
  type AnalyticsTrendPoint,
} from "@/lib/data";
import {
  buildEquipmentLeaderboardData,
  buildSweetSpotScatterData,
} from "@/lib/analytics";

type Action = {
  href: string;
  icon: LucideIcon;
  title: string;
};

type InsightTab = "low" | "best" | "equipment";

const supportHref =
  process.env.NEXT_PUBLIC_SUPPORT_FORM_URL?.trim() || "/support";
const supportIsExternal = /^https?:\/\//.test(supportHref);

function buildInsightMessage({
  hasRecords,
  latestScore,
  totalCups,
  activeDays,
}: {
  hasRecords: boolean;
  latestScore: number | null;
  totalCups: number;
  activeDays: number;
}) {
  if (!hasRecords) {
    return "尚無沖煮紀錄";
  }

  if (latestScore !== null && latestScore >= 4.3) {
    return "最近一杯有不錯的風味表現";
  }

  if (latestScore !== null && latestScore <= 3.2) {
    return "試著微調參數，看看下一杯會帶來什麼驚喜";
  }

  if (totalCups >= 5 && activeDays >= 4) {
    return "這週的樣本很完整，適合回頭比較器具手感";
  }

  return "每一次沖煮，都是找到甜蜜點的線索";
}

function formatRatio(dose: number, water: number) {
  if (dose <= 0) {
    return "-";
  }

  return `1:${(water / dose).toFixed(1)}`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function formatDateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(timestamp));
}

function buildRecordMeta(record: AnalyticsRecord) {
  return [
    record.equipment?.name ?? "未指定器具",
    formatRatio(record.dose, record.water),
    formatDuration(record.brewTime),
  ].join(" · ");
}

function buildReuseHref(record: AnalyticsRecord) {
  const params = new URLSearchParams({
    beanId: record.beanId,
    equipmentId: record.equipmentId,
    dose: String(record.dose),
    water: String(record.water),
    temperature: String(record.temperature),
    grindSize: record.grindSize ?? "",
    brewTime: String(record.brewTime),
  });

  if (record.bloomTime !== null) {
    params.set("bloomTime", String(record.bloomTime));
  }

  if (record.grinderId) {
    params.set("grinderId", record.grinderId);
  }

  if (record.filterId) {
    params.set("filterId", record.filterId);
  }

  return `/brew/new?${params.toString()}`;
}

function DecisionModule({
  icon: Icon,
  eyebrow,
  title,
  description,
  href,
  cta,
  meta,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
  href: string;
  cta: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200 hover:bg-dark-control active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-text-secondary">{eyebrow}</p>
          <p className="mt-1 truncate text-base font-semibold text-text-primary">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
          ) : null}
          {meta ? (
            <p className={`${description ? "mt-3" : "mt-2"} truncate text-xs text-text-secondary`}>
              {meta}
            </p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-dark-control text-text-secondary">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">{cta}</span>
        <ArrowRight className="h-4 w-4 text-text-secondary" />
      </div>
    </Link>
  );
}

function CompactStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-dark-control px-3 py-3 transition-colors duration-200">
      <p className="text-[11px] font-medium text-text-secondary">{label}</p>
      <p className="mt-1 tabular-nums text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function AnalyticsLineChart({
  points,
}: {
  points: AnalyticsTrendPoint[];
}) {
  const gradientId = useId();
  const glowId = useId();
  const width = 340;
  const height = 188;
  const padding = { top: 16, right: 10, bottom: 30, left: 10 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const baseline = padding.top + innerHeight;
  const definedPoints = points.flatMap((point, index) => {
    if (point.avgScore === null) {
      return [];
    }

    const x =
      points.length <= 1
        ? padding.left + innerWidth / 2
        : padding.left + (innerWidth * index) / (points.length - 1);
    const y = padding.top + innerHeight - (point.avgScore / 5) * innerHeight;

    return [{ ...point, index, x, y }];
  });

  const linePath = definedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    definedPoints.length > 1
      ? `${linePath} L ${definedPoints[definedPoints.length - 1].x} ${baseline} L ${definedPoints[0].x} ${baseline} Z`
      : "";
  const labelStride =
    points.length > 18 ? 6 : points.length > 12 ? 4 : points.length > 8 ? 3 : points.length > 5 ? 2 : 1;

  return (
    <div className="rounded-2xl border border-border-subtle bg-dark-control px-4 py-4 shadow-sm transition-colors duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-text-secondary">趨勢圖</p>
          <h3 className="mt-1 text-sm font-semibold text-text-primary">每日平均得分</h3>
        </div>
        <p className="text-xs text-text-secondary">0.0 - 5.0 分</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border-subtle bg-dark-base transition-colors duration-200">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line-soft)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0, 1, 2, 3, 4].map((lineIndex) => {
            const y = padding.top + (innerHeight / 4) * lineIndex;
            return (
              <line
                key={lineIndex}
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
            );
          })}

          {points.map((point, index) => {
            const x =
              points.length <= 1
                ? padding.left + innerWidth / 2
                : padding.left + (innerWidth * index) / (points.length - 1);
            const highlight = point.avgScore !== null;
            const showLabel =
              index === 0 ||
              index === points.length - 1 ||
              index === Math.floor((points.length - 1) / 2) ||
              index % labelStride === 0;

            return (
              <g key={point.key}>
                <line
                  x1={x}
                  x2={x}
                  y1={padding.top}
                  y2={baseline}
                  stroke={highlight ? "var(--chart-grid)" : "rgba(127,127,127,0.08)"}
                  strokeWidth="1"
                />
                {showLabel ? (
                  <text
                    x={x}
                    y={height - 10}
                    fill="var(--chart-axis)"
                    fontSize="9"
                    textAnchor="middle"
                    transform={`rotate(-38 ${x} ${height - 10})`}
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {areaPath ? (
            <path d={areaPath} fill={`url(#${gradientId})`} opacity="0.92" />
          ) : null}
          {linePath ? (
            <>
              <path
                d={linePath}
                fill="none"
                stroke="var(--chart-line-soft)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${glowId})`}
              />
              <path
                d={linePath}
                fill="none"
                stroke="var(--chart-line)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}

          {definedPoints.map((point) => (
            <g key={`${point.key}-dot`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="7"
                fill="var(--chart-dot)"
              />
              <circle cx={point.x} cy={point.y} r="3.5" fill="var(--chart-dot-core)" />
            </g>
          ))}

          {definedPoints.length === 0 ? (
            <text
              x={width / 2}
              y={height / 2}
              fill="var(--chart-axis)"
              fontSize="12"
              textAnchor="middle"
            >
              這段時間還沒有足夠的沖煮資料
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

function InsightTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "border border-cta-primary/25 bg-cta-primary/12 text-text-primary shadow-sm"
          : "bg-dark-control text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

export default function HomePage() {
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("week");
  const [insightTab, setInsightTab] = useState<InsightTab>("low");
  const [customStart, setCustomStart] = useState(() =>
    formatDateInputValue(Date.now() - 13 * 24 * 60 * 60 * 1000)
  );
  const [customEnd, setCustomEnd] = useState(() => formatDateInputValue(Date.now()));
  const recordsQuery = useLiveQuery<AnalyticsRecord[]>(
    () => getActiveAnalyticsRecords(),
    []
  );
  const records = useMemo(() => recordsQuery ?? [], [recordsQuery]);
  const latestRecord = records[0] ?? null;

  const actions: Action[] = [
    { href: "/brew/new", icon: Droplets, title: "新增沖煮" },
    { href: "/beans", icon: Bean, title: "咖啡豆" },
    { href: "/equipment", icon: FlaskConical, title: "器具" },
    {
      href: latestRecord ? `/records/detail?id=${latestRecord.id}` : "/records",
      icon: Sparkles,
      title: "AI Coach",
    },
  ];

  const weeklySnapshot = useMemo(
    () => buildAnalyticsSnapshot(records, "week", "", ""),
    [records]
  );
  const analyticsSnapshot = useMemo(
    () => buildAnalyticsSnapshot(records, analyticsRange, customStart, customEnd),
    [records, analyticsRange, customStart, customEnd]
  );
  const sweetSpotScatter = useMemo(
    () => buildSweetSpotScatterData(analyticsSnapshot.scopedRecords),
    [analyticsSnapshot]
  );
  const equipmentLeaderboard = useMemo(
    () => buildEquipmentLeaderboardData(analyticsSnapshot.scopedRecords),
    [analyticsSnapshot]
  );
  const totalCups = weeklySnapshot.totalCups;
  const activeDays = weeklySnapshot.activeDays;
  const latestScore = latestRecord ? latestRecord.score : null;
  const highScoreCount = weeklySnapshot.highScoreCount;
  const averageScore = weeklySnapshot.averageScore;
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );
  const insightMessage = buildInsightMessage({
    hasRecords: records.length > 0,
    latestScore,
    totalCups,
    activeDays,
  });
  const bestOfWeek = weeklySnapshot.bestRecipes.find((record) => record.score >= 4) ?? null;
  const needsTweakRecord = useMemo(
    () => records.find((record) => record.score < 3) ?? null,
    [records]
  );

  function openAnalytics(range: AnalyticsRange) {
    setAnalyticsRange(range);
    setIsAnalyticsOpen(true);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 overflow-x-hidden bg-dark-page px-4 pb-6 pt-2 text-text-primary transition-colors duration-200 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-text-secondary">{todayLabel}</p>
          <h1 className="truncate text-[1.65rem] font-bold tracking-tight text-text-primary">
            CoffeeLog
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <Link
            href={supportHref}
            target={supportIsExternal ? "_blank" : undefined}
            rel={supportIsExternal ? "noreferrer" : undefined}
            className="select-none inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-subtle bg-dark-panel text-text-secondary shadow-sm transition-colors duration-200 hover:bg-dark-control hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35 active:scale-95"
            aria-label="開啟支援"
          >
            <HelpCircle className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-text-secondary">今日摘要</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-text-primary">總覽</h2>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-dark-control text-text-secondary">
            <ChartColumn className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <CompactStat label="本週杯數" value={`${totalCups}`} />
          <CompactStat label="平均分數" value={averageScore.toFixed(1)} />
          <CompactStat label="高分杯數" value={`${highScoreCount}`} />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => openAnalytics("week")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cta-primary bg-cta-primary px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-[0.98]"
          >
            查看分析
          </button>
          <button
            type="button"
            onClick={() => openAnalytics("month")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-dark-control px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-dark-elevated active:scale-[0.98]"
          >
            本月
          </button>
        </div>
      </section>

      <Link
        href={latestRecord ? `/records/detail?id=${latestRecord.id}` : "/brew/new"}
        className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-dark-panel px-4 py-3 shadow-sm transition-colors duration-200 hover:bg-dark-control active:scale-[0.99]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-dark-control text-text-primary">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-text-secondary">AI 提醒</p>
          <p className="mt-1 line-clamp-1 text-sm leading-5 text-text-primary">{insightMessage}</p>
        </div>
        <span className="text-xs font-semibold text-text-secondary">查看</span>
      </Link>

      <section className="grid gap-3">
        <DecisionModule
          icon={Droplets}
          eyebrow="快速開始"
          title="新增沖煮"
          href="/brew/new"
          cta="立即開始"
          meta={
            latestRecord
              ? `最近一杯 ${formatDateLabel(latestRecord.createdAt)} · ${buildRecordMeta(latestRecord)}`
              : "尚未建立沖煮紀錄"
          }
        />

        {bestOfWeek ? (
          <DecisionModule
            icon={Award}
            eyebrow="本週風味之選"
            title={bestOfWeek.bean?.name ?? "未命名咖啡豆"}
            href={`/records/detail?id=${bestOfWeek.id}`}
            cta="查看紀錄"
            meta={`${formatDateLabel(bestOfWeek.createdAt)} · ${buildRecordMeta(bestOfWeek)}`}
          />
        ) : null}

        {needsTweakRecord ? (
          <DecisionModule
            icon={AlertTriangle}
            eyebrow="風味探索中"
            title={needsTweakRecord.bean?.name ?? "未命名咖啡豆"}
            href={`/records/detail?id=${needsTweakRecord.id}`}
            cta="查看紀錄"
            meta={`${formatDateLabel(needsTweakRecord.createdAt)} · ${buildRecordMeta(needsTweakRecord)}`}
          />
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.title}
              href={action.href}
              className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200 hover:bg-dark-control active:scale-[0.98]"
            >
              <div className="flex flex-col items-start gap-2.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-dark-control text-text-secondary">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="text-sm font-semibold text-text-primary">{action.title}</p>
              </div>
            </Link>
          );
        })}
      </section>

      {isAnalyticsOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm">
          <button
            type="button"
            aria-label="關閉分析面板"
            className="absolute inset-0"
            onClick={() => setIsAnalyticsOpen(false)}
          />
          <section className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-hidden rounded-t-[2rem] border-t border-border-subtle bg-dark-panel shadow-sm transition-colors duration-200 sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2 sm:rounded-[2rem] sm:border sm:border-border-subtle">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-white/10" />
            <div className="max-h-[calc(90vh-1.5rem)] overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary">統計分析</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-text-primary">
                    {analyticsSnapshot.rangeLabel}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnalyticsOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-subtle bg-dark-control text-text-secondary transition hover:text-text-primary active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 inline-flex rounded-xl border border-border-subtle bg-dark-control p-1">
                {(
                  [
                    ["week", "本週"],
                    ["month", "本月"],
                    ["custom", "自訂區間"],
                  ] as Array<[AnalyticsRange, string]>
                ).map(([range, label]) => {
                  const active = analyticsRange === range;

                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setAnalyticsRange(range)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-dark-panel text-text-primary"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {analyticsRange === "custom" ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="rounded-xl border border-border-subtle bg-dark-control px-3 py-3">
                    <span className="text-[11px] font-semibold text-text-secondary">起始日</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                      className="mt-2 w-full rounded-lg bg-transparent text-sm text-text-primary focus-visible:outline-none"
                    />
                  </label>
                  <label className="rounded-xl border border-border-subtle bg-dark-control px-3 py-3">
                    <span className="text-[11px] font-semibold text-text-secondary">結束日</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                      className="mt-2 w-full rounded-lg bg-transparent text-sm text-text-primary focus-visible:outline-none"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <CompactStat label="總杯數" value={`${analyticsSnapshot.totalCups}`} />
                <CompactStat
                  label="平均分數"
                  value={analyticsSnapshot.averageScore.toFixed(1)}
                />
                <CompactStat label="活躍天數" value={`${analyticsSnapshot.activeDays}`} />
                <CompactStat
                  label="4.0+ 杯數"
                  value={`${analyticsSnapshot.highScoreCount}`}
                />
              </div>

              <div className="mt-4">
                <AnalyticsLineChart points={analyticsSnapshot.trendPoints} />
              </div>

              <div className="mt-4 grid gap-4">
                <SweetSpotScatterPlot data={sweetSpotScatter} />
                <EquipmentLeaderboard data={equipmentLeaderboard} />
              </div>

              <div className="mt-4 flex gap-2">
                <InsightTabButton
                  active={insightTab === "low"}
                  label="風味探索"
                  onClick={() => setInsightTab("low")}
                />
                <InsightTabButton
                  active={insightTab === "best"}
                  label="風味之選"
                  onClick={() => setInsightTab("best")}
                />
                <InsightTabButton
                  active={insightTab === "equipment"}
                  label="器具手感"
                  onClick={() => setInsightTab("equipment")}
                />
              </div>

              <div className="mt-4 rounded-[1.35rem] border border-border-subtle bg-dark-control px-4 py-4">
              {insightTab === "low" ? (
                analyticsSnapshot.lowScoreRecords.length > 0 ? (
                  <div className="space-y-3">
                    {analyticsSnapshot.lowScoreRecords.map((record) => (
                      <Link
                        key={record.id}
                        href={`/records/detail?id=${record.id}`}
                        className="block rounded-xl border border-border-subtle bg-dark-panel px-3 py-3 transition hover:bg-dark-control"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {record.bean?.name ?? "未命名咖啡豆"}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {formatDateLabel(record.createdAt)} ·{" "}
                              {record.equipment?.name ?? "未知器具"} · {record.score.toFixed(1)} 分
                            </p>
                          </div>
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-5 text-text-secondary">
                          {record.feedback ?? "無筆記"}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-text-secondary">這段時間的風味都很穩定，還沒有特別需要回頭看的那一杯。</p>
                )
              ) : null}

              {insightTab === "best" ? (
                analyticsSnapshot.bestRecipes.length > 0 ? (
                  <div className="space-y-3">
                    {analyticsSnapshot.bestRecipes.map((record, index) => (
                      <article
                        key={record.id}
                        className="rounded-xl border border-border-subtle bg-dark-panel px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-text-secondary">
                              TOP {index + 1}
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-text-primary">
                              {record.bean?.name ?? "未命名咖啡豆"}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {record.equipment?.name ?? "未知器具"} · {buildRecordMeta(record)}
                            </p>
                          </div>
                          <p className="tabular-nums text-lg font-semibold text-text-primary">
                            {record.score.toFixed(1)}
                          </p>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Link
                            href={buildReuseHref(record)}
                            className="inline-flex items-center justify-center rounded-xl border border-cta-primary bg-cta-primary px-3 py-2 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 active:scale-[0.98]"
                          >
                            一鍵帶入新沖煮
                          </Link>
                          <Link
                            href={`/records/detail?id=${record.id}`}
                            className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-dark-control px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-dark-elevated"
                          >
                            查看詳情
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-text-secondary">這段時間沒有足夠的高分樣本。</p>
                )
              ) : null}

              {insightTab === "equipment" ? (
                analyticsSnapshot.equipmentComparison.length > 0 ? (
                  <div className="space-y-3">
                    {analyticsSnapshot.equipmentComparison.map((item) => (
                      <div
                        key={item.equipmentId ?? item.label}
                        className="rounded-xl border border-border-subtle bg-dark-panel px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {item.count} 杯樣本
                            </p>
                          </div>
                          <p className="tabular-nums text-sm font-semibold text-text-primary">
                            {item.averageScore.toFixed(1)} 分
                          </p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-dark-base">
                          <div
                            className="h-full rounded-full bg-cta-primary"
                            style={{
                              width: `${Math.max(
                                10,
                                Math.min(100, (item.averageScore / 5) * 100)
                              )}%`,
                              boxShadow:
                                "0 0 12px color-mix(in srgb, var(--cta-primary) 36%, transparent)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-text-secondary">目前沒有足夠資料可比較器具。</p>
                )
              ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
