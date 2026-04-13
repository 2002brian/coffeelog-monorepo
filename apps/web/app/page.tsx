"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  Bean,
  Droplets,
  FlaskConical,
  HelpCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { getActiveAnalyticsRecords } from "@/hooks/useBrewData";
import { buildAnalyticsSnapshot, type AnalyticsRecord } from "@/lib/data";

type Action = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

type WeeklyRhythmDay = {
  key: string;
  label: string;
  cups: number;
  isToday: boolean;
};

const supportHref =
  process.env.NEXT_PUBLIC_SUPPORT_FORM_URL?.trim() || "/support";
const supportIsExternal = /^https?:\/\//.test(supportHref);
const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getLocalDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(reference: Date) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - mondayOffset);

  return start;
}

function buildMonthlyMemory(records: AnalyticsRecord[], activeDays: number) {
  if (records.length === 0) {
    return "這個月還沒有留下沖煮記憶，等第一杯香氣升起時，這裡會記住它。";
  }

  const beanCounts = new Map<string, { name: string; count: number }>();

  records.forEach((record) => {
    const beanName = record.bean?.name?.trim() || "這支豆子";
    const current = beanCounts.get(beanName);

    if (current) {
      current.count += 1;
      return;
    }

    beanCounts.set(beanName, { name: beanName, count: 1 });
  });

  const topBean =
    [...beanCounts.values()].sort((left, right) => right.count - left.count)[0]
      ?.name ?? "這支豆子";

  return `這個月，您與 ${topBean} 共度了 ${activeDays} 個清晨。`;
}

function buildWeeklyRhythm(records: AnalyticsRecord[]): WeeklyRhythmDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = getWeekStart(today);
  const countByDate = new Map<string, number>();

  records.forEach((record) => {
    const key = getLocalDateKey(record.createdAt);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  });

  return weekLabels.map((label, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = getLocalDateKey(date.getTime());

    return {
      key,
      label,
      cups: countByDate.get(key) ?? 0,
      isToday: key === getLocalDateKey(today.getTime()),
    };
  });
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: Action) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200 hover:bg-dark-control active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {description}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-dark-control text-text-secondary transition-colors duration-200 group-hover:text-text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Open
        </span>
        <ArrowRight className="h-4 w-4 text-text-secondary transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function MetricChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
    </div>
  );
}

function RhythmDots({ cups }: { cups: number }) {
  if (cups <= 0) {
    return <div className="h-2.5 w-2.5 rounded-full bg-white/8" />;
  }

  return (
    <div className="flex min-h-10 flex-wrap justify-center gap-2">
      {Array.from({ length: cups }).map((_, index) => (
        <span
          key={`${cups}-${index}`}
          className="h-2.5 w-2.5 rounded-full bg-cta-primary"
          style={{
            boxShadow:
              "0 0 10px color-mix(in srgb, var(--cta-primary) 36%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  const recordsQuery = useLiveQuery<AnalyticsRecord[]>(
    () => getActiveAnalyticsRecords(),
    []
  );
  const records = useMemo(() => recordsQuery ?? [], [recordsQuery]);
  const latestRecord = records[0] ?? null;
  const weeklySnapshot = useMemo(
    () => buildAnalyticsSnapshot(records, "week", "", ""),
    [records]
  );
  const monthlySnapshot = useMemo(
    () => buildAnalyticsSnapshot(records, "month", "", ""),
    [records]
  );
  const monthlyMemory = useMemo(
    () =>
      buildMonthlyMemory(
        monthlySnapshot.scopedRecords,
        monthlySnapshot.activeDays
      ),
    [monthlySnapshot]
  );
  const weeklyRhythm = useMemo(
    () => buildWeeklyRhythm(weeklySnapshot.scopedRecords),
    [weeklySnapshot]
  );
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const actions: Action[] = [
    {
      href: "/brew/new",
      icon: Droplets,
      title: "新增沖煮",
      description: "開始記下今天這杯的配方、節奏與風味。",
    },
    {
      href: "/beans",
      icon: Bean,
      title: "咖啡豆",
      description: "查看豆單、庫存與本月常喝的豆子。",
    },
    {
      href: "/equipment",
      icon: FlaskConical,
      title: "器具",
      description: "整理濾杯、磨豆機與常用器材配置。",
    },
    {
      href: latestRecord ? `/records/detail?id=${latestRecord.id}` : "/records",
      icon: Sparkles,
      title: "最近一杯",
      description: latestRecord
        ? "回到最近的紀錄，延續今天的手感。"
        : "還沒有沖煮紀錄，等第一杯建立後會出現在這裡。",
    },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-8 overflow-x-hidden bg-dark-page px-4 pb-6 pt-2 text-text-primary transition-colors duration-200 sm:px-6">
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

      <section className="rounded-[2rem] border border-border-subtle bg-surface-highlight px-5 py-6 shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition-colors duration-200 sm:px-6 sm:py-7">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
            Monthly Memory
          </p>
          <div className="mt-5 flex items-end gap-3">
            <p className="text-6xl font-semibold leading-none tracking-[-0.05em] text-text-primary sm:text-7xl">
              {monthlySnapshot.totalCups}
            </p>
            <p className="pb-2 text-sm font-medium text-text-secondary">
              cups this month
            </p>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-7 text-text-secondary sm:text-[15px]">
            {monthlyMemory}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricChip label="Weekly Total" value={`${weeklySnapshot.totalCups}`} />
        <MetricChip label="Monthly Total" value={`${monthlySnapshot.totalCups}`} />
      </section>

      <section className="rounded-[2rem] border border-border-subtle bg-surface-highlight px-5 py-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)] transition-colors duration-200 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              Weekly Rhythm
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
              這週的沖煮節奏
            </h2>
          </div>
          <div
            className="rounded-full border border-border-subtle px-3 py-1 text-xs font-semibold text-text-secondary"
            style={{
              boxShadow:
                weeklySnapshot.totalCups > 0
                  ? "0 0 16px color-mix(in srgb, var(--glow-primary) 28%, transparent)"
                  : undefined,
            }}
          >
            {weeklySnapshot.totalCups > 0
              ? `${weeklySnapshot.totalCups} cups in motion`
              : "Waiting for the first cup"}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-7 gap-2 sm:gap-3">
          {weeklyRhythm.map((day) => (
            <div
              key={day.key}
              className="flex min-h-28 flex-col items-center justify-between rounded-[1.4rem] border border-border-subtle bg-dark-panel px-2 py-4 text-center transition-colors duration-200"
              style={
                day.isToday
                  ? {
                      boxShadow:
                        "0 0 0 1px color-mix(in srgb, var(--glow-primary) 48%, transparent), 0 0 22px color-mix(in srgb, var(--glow-primary) 24%, transparent)",
                    }
                  : undefined
              }
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                {day.label}
              </span>
              <RhythmDots cups={day.cups} />
              <span className="text-xs font-medium text-text-secondary">
                {day.cups > 0 ? `${day.cups} cup${day.cups > 1 ? "s" : ""}` : "Rest"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
            Quick Access
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {actions.map((action) => (
            <ActionCard key={action.title} {...action} />
          ))}
        </div>
      </section>
    </main>
  );
}
