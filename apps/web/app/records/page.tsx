"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Funnel,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { type BrewRecord, type CoffeeBean, type Equipment } from "@/lib/db";
import { getAverageCupScore } from "@/lib/data";
import { getActiveBrewLogRelations } from "@/hooks/useBrewData";

type RecordWithRelations = BrewRecord & {
  bean: CoffeeBean | null;
  equipment: Equipment | null;
};

type SortOption = "date-desc" | "date-asc" | "score-desc";
type FilterOption = "all" | "score-4-plus" | `equipment:${string}`;

function formatRatio(dose: number, water: number) {
  if (dose <= 0) {
    return "-";
  }

  return `1:${(water / dose).toFixed(1)}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatDay(timestamp: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    day: "2-digit",
  }).format(new Date(timestamp));
}

function formatMonth(timestamp: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
  }).format(new Date(timestamp));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function getOverallScoreValue(record: BrewRecord) {
  return getAverageCupScore(record);
}

function getSortLabel(option: SortOption) {
  switch (option) {
    case "date-asc":
      return "日期 (最舊至最新)";
    case "score-desc":
      return "評分 (由高至低)";
    case "date-desc":
    default:
      return "日期 (最新至最舊)";
  }
}

function getFilterLabel(
  option: FilterOption,
  equipmentMap: Map<string, string>
) {
  if (option === "all") {
    return "全部紀錄";
  }

  if (option === "score-4-plus") {
    return "僅顯示 4.0+";
  }

  if (option.startsWith("equipment:")) {
    const equipmentId = option.replace("equipment:", "");
    return equipmentMap.get(equipmentId) ?? "指定器具";
  }

  return "全部紀錄";
}

function getOverallScore(record: BrewRecord) {
  return getOverallScoreValue(record).toFixed(1);
}

function buildRecordSummary(record: RecordWithRelations) {
  const parts = [
    record.equipment?.name ?? "未知器具",
    `${getOverallScore(record)} 分`,
    formatRatio(record.dose, record.water),
    formatDuration(record.brewTime),
  ];

  return parts.join(" · ");
}

function RecordListRow({ record }: { record: RecordWithRelations }) {
  return (
    <Link
      href={`/records/detail?id=${record.id}`}
      className="flex min-h-14 items-center gap-3 bg-dark-panel px-4 py-3 transition-colors duration-200 hover:bg-dark-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35"
      aria-label={`${record.bean?.name ?? "未命名咖啡豆"}，${formatDate(record.createdAt)}，${buildRecordSummary(record)}`}
    >
      <div className="flex w-14 shrink-0 flex-col items-start justify-center">
        <span className="text-xs font-semibold text-text-secondary">
          {formatMonth(record.createdAt)}
        </span>
        <span className="mt-1 text-lg font-bold leading-none tabular-nums text-cta-primary">
          {formatDay(record.createdAt)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">
          {record.bean?.name ?? "未命名咖啡豆"}
        </p>
        <p className="mt-1 truncate text-xs leading-5 text-text-secondary">
          {buildRecordSummary(record)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-[11px] font-medium text-text-secondary sm:inline">
          查看
        </span>
        <ChevronRight className="h-4 w-4 text-text-secondary" />
      </div>
    </Link>
  );
}

function QueryMenu({
  title,
  description,
  options,
  selectedValue,
  onSelect,
}: {
  title: string;
  description: string;
  options: Array<{ value: string; label: string; hint?: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border-subtle bg-dark-panel shadow-sm transition-colors duration-200">
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-xs leading-5 text-text-secondary">{description}</p>
      </div>

      <div className="p-2">
        {options.map((option) => {
          const active = option.value === selectedValue;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200 ${
                active
                  ? "bg-dark-control text-text-primary"
                  : "text-text-secondary hover:bg-dark-control/85 hover:text-text-primary"
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${active ? "text-text-primary" : ""}`}>
                  {option.label}
                </p>
                {option.hint ? (
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                    {option.hint}
                  </p>
                ) : null}
              </div>
              {active ? (
                <span className="mt-1 text-[11px] font-semibold text-cta-primary" aria-hidden="true">
                  已選取
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecordsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const restoredToastTimerRef = useRef<number | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [openMenu, setOpenMenu] = useState<"filter" | "sort" | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const records = useLiveQuery(() => getActiveBrewLogRelations(), []);

  useEffect(() => {
    if (searchParams.get("restored") !== "true") {
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    setShowRestoredToast(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("restored");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/records?${nextQuery}` : "/records");

    restoredToastTimerRef.current = window.setTimeout(() => {
      setShowRestoredToast(false);
    }, 3000);

    return () => {
      if (restoredToastTimerRef.current !== null) {
        window.clearTimeout(restoredToastTimerRef.current);
        restoredToastTimerRef.current = null;
      }
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (!openMenu) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenu]);

  function handleCloseToast() {
    if (restoredToastTimerRef.current !== null) {
      window.clearTimeout(restoredToastTimerRef.current);
      restoredToastTimerRef.current = null;
    }
    setShowRestoredToast(false);
  }

  const equipmentOptions = useMemo(() => {
    if (!records) {
      return [];
    }

    const seen = new Set<string>();

    return records
      .filter((record) => record.equipment?.id && record.equipment?.name)
      .filter((record) => {
        const equipmentId = record.equipment?.id;
        if (!equipmentId || seen.has(equipmentId)) {
          return false;
        }

        seen.add(equipmentId);
        return true;
      })
      .map((record) => ({
        value: `equipment:${record.equipment!.id}` as FilterOption,
        label: record.equipment!.name,
        hint: "只顯示此器具的沖煮紀錄",
      }));
  }, [records]);

  const equipmentLabelMap = useMemo(() => {
    const map = new Map<string, string>();

    equipmentOptions.forEach((option) => {
      const equipmentId = option.value.replace("equipment:", "");
      map.set(equipmentId, option.label);
    });

    return map;
  }, [equipmentOptions]);

  const sortOptions: Array<{ value: SortOption; label: string; hint: string }> = [
    {
      value: "date-desc",
      label: "日期 (最新至最舊)",
      hint: "優先查看最近一次沖煮與最新調整。",
    },
    {
      value: "date-asc",
      label: "日期 (最舊至最新)",
      hint: "依時間順序回看整段沖煮演進歷程。",
    },
    {
      value: "score-desc",
      label: "評分 (由高至低)",
      hint: "把高分沖煮紀錄排到最上方。",
    },
  ];

  const filterOptions: Array<{ value: FilterOption; label: string; hint: string }> = [
    {
      value: "all",
      label: "全部紀錄",
      hint: "顯示目前所有沖煮資料。",
    },
    {
      value: "score-4-plus",
      label: "僅顯示 4.0+",
      hint: "快速聚焦高分沖煮與可複製的成功配方。",
    },
    ...equipmentOptions,
  ];

  const visibleRecords = useMemo(() => {
    if (!records) {
      return [];
    }

    const filtered = records.filter((record) => {
      if (filterOption === "all") {
        return true;
      }

      if (filterOption === "score-4-plus") {
        return getOverallScoreValue(record) >= 4;
      }

      if (filterOption.startsWith("equipment:")) {
        return record.equipment?.id === filterOption.replace("equipment:", "");
      }

      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sortOption === "date-asc") {
        return left.createdAt - right.createdAt;
      }

      if (sortOption === "score-desc") {
        const scoreDelta = getOverallScoreValue(right) - getOverallScoreValue(left);

        if (scoreDelta !== 0) {
          return scoreDelta;
        }
      }

      return right.createdAt - left.createdAt;
    });
  }, [filterOption, records, sortOption]);

  if (records === undefined) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
            歷史紀錄
          </h1>
          <p className="text-sm leading-6 text-text-secondary">
            正在從本地資料庫載入資料。
          </p>
        </header>

        <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 text-center shadow-sm transition-colors duration-200">
          <p className="text-sm leading-6 text-text-secondary">
            載入中...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      {showRestoredToast ? (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-50 flex w-[min(92vw,32rem)] -translate-x-1/2 items-start justify-between gap-4 rounded-xl border border-status-success/20 bg-dark-panel px-4 py-3 text-sm font-medium text-status-success shadow-sm transition-colors duration-200">
          <p className="leading-6">資料還原完成，已套用到目前的本機紀錄。</p>
          <button
            type="button"
            onClick={handleCloseToast}
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-dark-control text-status-success transition-colors duration-200 hover:bg-dark-page active:scale-95"
            aria-label="關閉提示"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <header className="space-y-2">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
          歷史紀錄
        </h1>
        <p className="text-sm leading-6 text-text-secondary">
          以清單快速掃描每一杯，進入詳情頁再查看完整參數與感官資料。
        </p>
      </header>

      <div
        ref={menuContainerRef}
        className="relative flex flex-wrap items-start gap-3"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((current) => (current === "filter" ? null : "filter"))
            }
            className="inline-flex select-none items-center gap-2 rounded-xl border border-border-subtle bg-dark-panel px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-dark-control hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35 active:scale-95"
          >
            <Funnel className="h-4 w-4" />
            <span>篩選</span>
            <span className="rounded-full bg-dark-control px-2 py-0.5 text-xs font-semibold text-text-primary">
              {getFilterLabel(filterOption, equipmentLabelMap)}
            </span>
          </button>

          {openMenu === "filter" ? (
            <QueryMenu
              title="篩選紀錄"
              description="快速聚焦特定器具或高分沖煮紀錄。"
              options={filterOptions}
              selectedValue={filterOption}
              onSelect={(value) => {
                setFilterOption(value as FilterOption);
                setOpenMenu(null);
              }}
            />
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((current) => (current === "sort" ? null : "sort"))
            }
            className="inline-flex select-none items-center gap-2 rounded-xl border border-border-subtle bg-dark-panel px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-dark-control hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35 active:scale-95"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>排序</span>
            <span className="rounded-full bg-dark-control px-2 py-0.5 text-xs font-semibold text-text-primary">
              {getSortLabel(sortOption)}
            </span>
          </button>

          {openMenu === "sort" ? (
            <QueryMenu
              title="排序紀錄"
              description="選擇你想要優先檢視的排序方式。"
              options={sortOptions}
              selectedValue={sortOption}
              onSelect={(value) => {
                setSortOption(value as SortOption);
                setOpenMenu(null);
              }}
            />
          ) : null}
        </div>
      </div>

      {records.length === 0 ? (
        <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 text-center shadow-sm transition-colors duration-200">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            尚未建立任何沖煮紀錄
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            先從一支咖啡豆開始，建立第一筆沖煮資料。
          </p>
        </section>
      ) : visibleRecords.length === 0 ? (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 text-center shadow-sm transition-colors duration-200">
          <div className="mx-auto max-w-xl space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              目前沒有符合此條件的紀錄
            </h2>
            <p className="text-sm leading-6 text-text-secondary">
              你可以清除目前的篩選設定，或改用其他器具與排序條件重新查看歷史資料。
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterOption("all");
                setSortOption("date-desc");
              }}
              className="inline-flex select-none items-center justify-center rounded-xl border border-cta-primary bg-cta-primary px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-sm transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35 active:scale-95"
            >
              清除篩選
            </button>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[1.1rem] border border-border-subtle bg-dark-panel shadow-sm transition-colors duration-200">
          <div className="divide-y divide-border-subtle">
            {visibleRecords.map((record) => (
              <RecordListRow key={record.id} record={record} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default function RecordsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
          <header className="space-y-2">
            <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
              歷史紀錄
            </h1>
            <p className="text-sm leading-6 text-text-secondary">
              正在從本地資料庫載入資料。
            </p>
          </header>

          <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 text-center shadow-sm transition-colors duration-200">
            <p className="text-sm leading-6 text-text-secondary">
              載入中...
            </p>
          </section>
        </main>
      }
    >
      <RecordsPageContent />
    </Suspense>
  );
}
