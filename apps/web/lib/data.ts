import type { BrewRecord, CoffeeBean, Equipment } from "@/lib/db";

export type AnalyticsRange = "week" | "month" | "custom";

export type AnalyticsRecord = BrewRecord & {
  bean: CoffeeBean | null;
  equipment: Equipment | null;
  score: number;
};

export type AnalyticsTrendPoint = {
  key: string;
  label: string;
  fullLabel: string;
  cups: number;
  avgScore: number | null;
};

export type EquipmentComparison = {
  equipmentId: string | null;
  label: string;
  averageScore: number;
  count: number;
};

export type AnalyticsSnapshot = {
  rangeLabel: string;
  scopedRecords: AnalyticsRecord[];
  trendPoints: AnalyticsTrendPoint[];
  totalCups: number;
  activeDays: number;
  highScoreCount: number;
  averageScore: number;
  lowScoreRecords: AnalyticsRecord[];
  bestRecipes: AnalyticsRecord[];
  equipmentComparison: EquipmentComparison[];
};

export function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day).getTime();
}

export function formatDateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getAverageCupScore(record: {
  acidity: number;
  sweetness: number;
  body: number;
  bitterness: number;
}) {
  return Number(
    (
      (record.acidity + record.sweetness + record.body + (5 - record.bitterness)) /
      4
    ).toFixed(1)
  );
}

function getRangeMeta(
  range: AnalyticsRange,
  customStart: string,
  customEnd: string
) {
  const today = startOfDay(Date.now());

  if (range === "week") {
    return {
      start: startOfDay(today - 6 * 24 * 60 * 60 * 1000),
      end: endOfDay(today),
      label: "本週",
    };
  }

  if (range === "month") {
    return {
      start: startOfDay(today - 29 * 24 * 60 * 60 * 1000),
      end: endOfDay(today),
      label: "本月",
    };
  }

  const parsedStart = parseDateInput(customStart) ?? startOfDay(today);
  const parsedEnd = parseDateInput(customEnd) ?? startOfDay(today);
  const safeStart = Math.min(parsedStart, parsedEnd);
  const safeEnd = Math.max(parsedStart, parsedEnd);

  return {
    start: startOfDay(safeStart),
    end: endOfDay(safeEnd),
    label: "自訂區間",
  };
}

function buildTrendPoints(
  records: AnalyticsRecord[],
  start: number,
  end: number
) {
  const points: AnalyticsTrendPoint[] = [];

  for (
    let cursor = startOfDay(start);
    cursor <= startOfDay(end);
    cursor += 24 * 60 * 60 * 1000
  ) {
    const dayRecords = records.filter(
      (record) => startOfDay(record.createdAt) === cursor
    );
    const avgScore =
      dayRecords.length > 0
        ? Number(
            (
              dayRecords.reduce((sum, record) => sum + record.score, 0) /
              dayRecords.length
            ).toFixed(1)
          )
        : null;

    points.push({
      key: String(cursor),
      label: new Intl.DateTimeFormat("zh-TW", {
        month: "numeric",
        day: "numeric",
      }).format(new Date(cursor)),
      fullLabel: new Intl.DateTimeFormat("zh-TW", {
        month: "long",
        day: "numeric",
      }).format(new Date(cursor)),
      cups: dayRecords.length,
      avgScore,
    });
  }

  return points;
}

function buildEquipmentComparison(records: AnalyticsRecord[]) {
  const groups = new Map<
    string,
    { equipmentId: string | null; label: string; total: number; count: number }
  >();

  records.forEach((record) => {
    const key = record.equipment?.id ?? "unknown";
    const existing = groups.get(key) ?? {
      equipmentId: record.equipment?.id ?? null,
      label: record.equipment?.name ?? "未知器具",
      total: 0,
      count: 0,
    };

    existing.total += record.score;
    existing.count += 1;
    groups.set(key, existing);
  });

  return [...groups.values()]
    .map((item) => ({
      equipmentId: item.equipmentId,
      label: item.label,
      averageScore: Number((item.total / item.count).toFixed(1)),
      count: item.count,
    }))
    .sort((left, right) => right.averageScore - left.averageScore);
}

export function buildAnalyticsSnapshot(
  records: AnalyticsRecord[],
  range: AnalyticsRange,
  customStart: string,
  customEnd: string
): AnalyticsSnapshot {
  const { start, end, label } = getRangeMeta(range, customStart, customEnd);
  const scopedRecords = records.filter(
    (record) => record.createdAt >= start && record.createdAt <= end
  );
  const activeDays = new Set(
    scopedRecords.map((record) => startOfDay(record.createdAt))
  ).size;
  const highScoreCount = scopedRecords.filter((record) => record.score >= 4).length;
  const averageScore =
    scopedRecords.length > 0
      ? Number(
          (
            scopedRecords.reduce((sum, record) => sum + record.score, 0) /
            scopedRecords.length
          ).toFixed(1)
        )
      : 0;

  return {
    rangeLabel: label,
    scopedRecords,
    trendPoints: buildTrendPoints(scopedRecords, start, end),
    totalCups: scopedRecords.length,
    activeDays,
    highScoreCount,
    averageScore,
    lowScoreRecords: scopedRecords
      .filter((record) => record.score < 3)
      .sort((left, right) => right.createdAt - left.createdAt),
    bestRecipes: [...scopedRecords]
      .sort((left, right) => right.score - left.score)
      .slice(0, 3),
    equipmentComparison: buildEquipmentComparison(scopedRecords),
  };
}
