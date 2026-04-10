"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import AICoach from "@/components/AICoach";
import { type LocalBrewContext } from "@/lib/db";
import { getActiveBrewLogContext } from "@/hooks/useBrewData";

function SummaryMetric({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-dark-control px-3 py-3 shadow-sm transition-colors duration-200">
      <p className="text-[11px] font-medium text-text-secondary">
        {label}
      </p>
      <p
        className={`mt-2 truncate font-mono font-semibold tabular-nums ${
          emphasize ? "text-lg text-text-primary" : "text-sm text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatRatio(dose: number, water: number) {
  if (dose <= 0) {
    return "-";
  }

  return `1:${(water / dose).toFixed(1)}`;
}

function extractFlavorTags(notes: string | null | undefined) {
  if (!notes) return [];

  return notes
    .split(/[,/、]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function getOverallScore(record: LocalBrewContext["record"]) {
  return (
    (record.acidity + record.sweetness + record.body + (5 - record.bitterness)) /
    4
  ).toFixed(1);
}

function SensoryMicroStats({
  values,
}: {
  values: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
      <p className="text-[11px] font-medium text-text-secondary">
        感官評分
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-4">
        {values.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center rounded-[1rem] border border-border-subtle bg-dark-control px-2 py-3 text-center transition-colors duration-200"
          >
            <span className="tabular-nums text-xl font-bold leading-none text-cta-primary">
              {item.value}
              <span className="text-sm font-semibold text-cta-primary/80">/5</span>
            </span>
            <span className="mt-2 text-[11px] font-semibold text-text-secondary">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordDetailContent() {
  const searchParams = useSearchParams();
  const recordId = searchParams.get("id")?.trim() ?? "";
  const context = useLiveQuery<LocalBrewContext | null>(
    () => (recordId ? getActiveBrewLogContext(recordId) : Promise.resolve(null)),
    [recordId]
  );

  if (context === undefined) {
    return (
      <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <p className="text-sm leading-6 text-text-secondary">
          正在從本地資料庫載入詳細紀錄。
        </p>
      </section>
    );
  }

  if (!context) {
    return (
      <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <p className="text-sm leading-6 text-text-secondary">
          找不到對應的沖煮紀錄。
        </p>
      </section>
    );
  }

  const { record, bean, equipment } = context;
  const flavorTags = extractFlavorTags(bean?.notes);
  const sensoryValues = [
    { label: "酸度", value: record.acidity },
    { label: "甜度", value: record.sweetness },
    { label: "醇厚感", value: record.body },
    { label: "苦味強度", value: record.bitterness },
  ];
  const overallScore = getOverallScore(record);

  return (
    <>
      <section className="rounded-[1.25rem] border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200 md:sticky md:top-[calc(env(safe-area-inset-top)+0.75rem)] md:z-10 md:bg-dark-panel/95 md:backdrop-blur">
        <header className="space-y-2">
          <p className="text-[11px] font-medium text-text-secondary">沖煮詳情</p>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
            {bean?.name ?? "未命名咖啡豆"}
          </h1>
          <p className="text-sm leading-6 text-text-secondary">
            {new Date(record.createdAt).toLocaleString("zh-TW")} ·{" "}
            {bean?.origin ?? "未知產區"} · {bean?.process ?? "未知處理法"}
          </p>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMetric label="總分" value={`${overallScore} / 5`} emphasize />
          <SummaryMetric label="器具" value={equipment?.name ?? "-"} />
          <SummaryMetric label="總時間" value={formatDuration(record.brewTime)} />
          <SummaryMetric label="粉水比" value={formatRatio(record.dose, record.water)} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-border-subtle bg-dark-control px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200">
            粉量 {record.dose}g
          </span>
          <span className="inline-flex rounded-full border border-border-subtle bg-dark-control px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200">
            水量 {record.water}g
          </span>
          <span className="inline-flex rounded-full border border-border-subtle bg-dark-control px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200">
            水溫 {record.temperature}°C
          </span>
          {context.grinder ? (
            <span className="inline-flex rounded-full border border-border-subtle bg-dark-control px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200">
              磨豆機 {context.grinder.name}
            </span>
          ) : null}
          {context.filter ? (
            <span className="inline-flex rounded-full border border-border-subtle bg-dark-control px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200">
              濾紙 {context.filter.name}
            </span>
          ) : null}
          <span className="inline-flex rounded-full border border-border-subtle bg-dark-control px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200">
            悶蒸 {record.bloomTime !== null ? `${record.bloomTime}s` : "-"}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-text-secondary">深入分析</p>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            主觀感受與風味筆記
          </h2>
          <p className="text-sm leading-6 text-text-secondary">
            先看感官分數，再對照風味標籤與文字觀察，判斷這杯是否值得複製或修正。
          </p>
        </div>

        <div className="mt-5">
          <SensoryMicroStats values={sensoryValues} />
        </div>

        <div className="mt-5 rounded-xl border border-border-subtle bg-dark-control px-4 py-4 transition-colors duration-200">
          <div>
            <p className="text-[11px] font-medium text-text-secondary">
              風味標籤
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {flavorTags.length > 0 ? (
                flavorTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full border border-border-subtle bg-dark-page px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="inline-flex rounded-full border border-border-subtle bg-dark-page px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200">
                  尚未設定風味標籤
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-border-subtle pt-5">
            <p className="text-[11px] font-medium text-text-secondary">
              沖煮筆記
            </p>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              {record.feedback ?? "尚未留下文字評價。"}
            </p>
          </div>
        </div>
      </section>

      <AICoach localContext={context} />
    </>
  );
}

export default function RecordDetailPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-5 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <Suspense
        fallback={
          <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
            <p className="text-sm leading-6 text-text-secondary">
              載入中...
            </p>
          </section>
        }
      >
        <RecordDetailContent />
      </Suspense>
    </main>
  );
}
