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

const supportHref =
  process.env.NEXT_PUBLIC_SUPPORT_FORM_URL?.trim() || "/support";
const supportIsExternal = /^https?:\/\//.test(supportHref);

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

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="glass-chip ui-rhythm rounded-3xl px-4 py-4">
      <p className="type-caption uppercase tracking-[0.2em] text-text-secondary">
        {label}
      </p>
      <p className="mt-3 text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-text-primary">
        {value}
      </p>
    </div>
  );
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
      className="glass-chip ui-rhythm group flex min-h-32 flex-col justify-between rounded-[1.6rem] px-5 py-5 hover:border-white/16 hover:bg-white/8 active:scale-[0.985]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-body text-text-primary">{title}</p>
          <p className="type-secondary mt-2 text-text-secondary">
            {description}
          </p>
        </div>
        <div className="glass-chip ui-rhythm flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-text-secondary group-hover:text-text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="type-caption uppercase tracking-[0.2em] text-text-secondary">
          Open
        </span>
        <ArrowRight className="ui-rhythm h-5 w-5 text-text-secondary group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function HomePage() {
  const recordsQuery = useLiveQuery<AnalyticsRecord[]>(
    () => getActiveAnalyticsRecords(),
    []
  );
  const records = useMemo(() => recordsQuery ?? [], [recordsQuery]);
  const latestRecord = records[0] ?? null;
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

  const averageScoreLabel =
    monthlySnapshot.averageScore > 0
      ? monthlySnapshot.averageScore.toFixed(1)
      : "—";

  return (
    <div className="ambient-page relative isolate min-h-[100dvh] overflow-hidden text-text-primary">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary-default/15 blur-[90px]" />
        <div className="absolute right-[-5rem] top-24 h-72 w-72 rounded-full bg-cta-primary/12 blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-4 pt-3 sm:px-6">
        <header className="flex items-start justify-between gap-4 pt-1">
          <div className="min-w-0 space-y-2">
            <p className="type-secondary text-text-secondary">{todayLabel}</p>
            <div className="space-y-1">
              <p className="type-caption uppercase tracking-[0.2em] text-primary-default/90">
                Coffee Rhythm
              </p>
              <h1 className="type-section truncate text-text-primary">CoffeeLog</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              href={supportHref}
              target={supportIsExternal ? "_blank" : undefined}
              rel={supportIsExternal ? "noreferrer" : undefined}
              className="glass-chip ui-rhythm inline-flex h-11 w-11 items-center justify-center rounded-2xl text-text-secondary hover:text-text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35"
              aria-label="開啟支援"
            >
              <HelpCircle className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <div className="glass-panel ui-rhythm space-y-3 rounded-[1.75rem] px-6 py-5">
          <p className="type-caption uppercase tracking-[0.24em] text-text-secondary">
            Glass & Rhythm
          </p>
          <p className="type-body max-w-2xl text-text-secondary">
            用毛玻璃層次與節奏化摘要，把每杯咖啡從紀錄表格改成更接近
            iPhone 原生的每日狀態畫面。
          </p>
        </div>

        <div
          className="snap-cards flex flex-col gap-5 pb-4"
          style={{ scrollSnapType: "y proximity" }}
        >
          <section className="glass-panel-strong snap-card ui-rhythm w-full px-6 py-6 sm:px-7 sm:py-7">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="type-caption uppercase tracking-[0.24em] text-text-secondary">
                  Hero / Monthly Memory
                </p>
                <h2 className="type-section text-text-primary">本月記憶</h2>
                <p className="type-body max-w-xl text-text-secondary">
                  {monthlyMemory}
                </p>
              </div>

              <div className="flex items-end gap-3">
                <p className="type-display text-text-primary">
                  {monthlySnapshot.totalCups}
                </p>
                <p className="type-secondary pb-2 text-text-secondary">
                  cups this month
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatChip
                  label="Active Days"
                  value={`${monthlySnapshot.activeDays}`}
                />
                <StatChip label="Avg Score" value={averageScoreLabel} />
              </div>
            </div>
          </section>

          <section className="glass-panel snap-card ui-rhythm w-full px-6 py-6 sm:px-7 sm:py-7">
            <div className="space-y-3">
              <p className="type-caption uppercase tracking-[0.24em] text-text-secondary">
                Quick Actions
              </p>
              <h2 className="type-section text-text-primary">快速入口</h2>
              <p className="type-secondary max-w-lg text-text-secondary">
                把最常回訪的任務收進一張卡，讓首頁維持乾淨，但操作不需要多一步。
              </p>
            </div>

            <div className="mt-7 grid gap-3">
              {actions.map((action) => (
                <ActionCard key={action.title} {...action} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
