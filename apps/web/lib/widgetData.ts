import { useLiveQuery } from "dexie-react-hooks";
import { getAverageCupScore, startOfDay } from "@/lib/data";
import { type BrewRecord } from "@/lib/db";
import { getActiveBeans, getActiveBrewLogs, getActiveEquipments } from "@/hooks/useBrewData";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type WidgetStatus =
  | "no_data"
  | "insufficient_data"
  | "needs_tweak"
  | "hall_of_fame"
  | "normal";

export type WidgetTrendPoint = {
  label: string;
  cups: number;
  score: number | null;
};

export type WidgetBestRecipe = {
  beanName: string;
  equipmentName: string;
  score: number;
  brewedAt: number;
  ratio: string;
};

export type WidgetPayload = {
  status: WidgetStatus;
  totalCups: number;
  todayCups: number;
  weekCups: number;
  weekAverageScore: number | null;
  recentAverageScore: number | null;
  latestScore: number | null;
  bestRecipe: WidgetBestRecipe | null;
  trend: WidgetTrendPoint[];
  updatedAt: number | null;
};

export type SharedWidgetPayload = {
  status: WidgetStatus;
  generatedAt: number;
  counts: {
    total: number;
    today: number;
    week: number;
  };
  scores: {
    weekAverage: number | null;
    recentAverage: number | null;
    latest: number | null;
  };
  bestRecipe: WidgetBestRecipe | null;
  trend: WidgetTrendPoint[];
  updatedAt: number | null;
};

type WidgetRecord = BrewRecord & {
  beanName: string;
  equipmentName: string;
  score: number;
};

export const WIDGET_PREVIEW_STATES: WidgetStatus[] = [
  "no_data",
  "insufficient_data",
  "needs_tweak",
  "normal",
  "hall_of_fame",
];

function roundScore(value: number) {
  return Number(value.toFixed(1));
}

function averageScores(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatRatio(dose: number, water: number) {
  if (dose <= 0) {
    return "-";
  }

  return `1:${(water / dose).toFixed(1)}`;
}

function buildWidgetTrend(records: WidgetRecord[], now: number) {
  const points: WidgetTrendPoint[] = [];
  const today = startOfDay(now);

  for (let index = 6; index >= 0; index -= 1) {
    const cursor = today - index * DAY_IN_MS;
    const dayRecords = records.filter((record) => startOfDay(record.createdAt) === cursor);
    const score = averageScores(dayRecords.map((record) => record.score));

    points.push({
      label: new Intl.DateTimeFormat("zh-TW", {
        month: "numeric",
        day: "numeric",
      }).format(new Date(cursor)),
      cups: dayRecords.length,
      score,
    });
  }

  return points;
}

function resolveWidgetStatus(records: WidgetRecord[]) {
  if (records.length === 0) {
    return "no_data" as const;
  }

  if (records.length < 3) {
    return "insufficient_data" as const;
  }

  const recentRecords = records.slice(0, 3);
  const recentAverage = averageScores(recentRecords.map((record) => record.score));

  if (recentAverage !== null && recentAverage < 3) {
    return "needs_tweak" as const;
  }

  if (recentRecords.some((record) => record.score >= 4.5)) {
    return "hall_of_fame" as const;
  }

  return "normal" as const;
}

export function buildWidgetPayload(
  records: WidgetRecord[],
  now = Date.now()
): WidgetPayload {
  const sortedRecords = [...records].sort((left, right) => right.createdAt - left.createdAt);
  const today = startOfDay(now);
  const weekStart = today - 6 * DAY_IN_MS;
  const weekRecords = sortedRecords.filter((record) => record.createdAt >= weekStart);
  const recentRecords = sortedRecords.slice(0, 3);
  const bestRecord = [...sortedRecords].sort((left, right) => right.score - left.score)[0] ?? null;

  return {
    status: resolveWidgetStatus(sortedRecords),
    totalCups: sortedRecords.length,
    todayCups: sortedRecords.filter((record) => startOfDay(record.createdAt) === today).length,
    weekCups: weekRecords.length,
    weekAverageScore: averageScores(weekRecords.map((record) => record.score)),
    recentAverageScore: averageScores(recentRecords.map((record) => record.score)),
    latestScore: sortedRecords[0]?.score ?? null,
    bestRecipe: bestRecord
      ? {
          beanName: bestRecord.beanName,
          equipmentName: bestRecord.equipmentName,
          score: bestRecord.score,
          brewedAt: bestRecord.createdAt,
          ratio: formatRatio(bestRecord.dose, bestRecord.water),
        }
      : null,
    trend: buildWidgetTrend(sortedRecords, now),
    updatedAt: sortedRecords[0]?.updatedAt ?? null,
  };
}

async function loadWidgetPayload() {
  const [brewRecords, beans, equipments] = await Promise.all([
    getActiveBrewLogs(),
    getActiveBeans(),
    getActiveEquipments(),
  ]);

  const beanMap = new Map<string, (typeof beans)[number]>(beans.map((bean) => [bean.id, bean]));
  const equipmentMap = new Map<string, (typeof equipments)[number]>(
    equipments.map((equipment) => [equipment.id, equipment])
  );

  const widgetRecords: WidgetRecord[] = brewRecords.map((record) => ({
    ...record,
    beanName: beanMap.get(record.beanId)?.name ?? "未命名豆子",
    equipmentName: equipmentMap.get(record.equipmentId)?.name ?? "未指定器具",
    score: getAverageCupScore(record),
  }));

  return buildWidgetPayload(widgetRecords);
}

export function useWidgetPayload() {
  return useLiveQuery(loadWidgetPayload, []);
}

export function serializeWidgetPayload(payload: WidgetPayload): SharedWidgetPayload {
  return {
    status: payload.status,
    generatedAt: Date.now(),
    counts: {
      total: payload.totalCups,
      today: payload.todayCups,
      week: payload.weekCups,
    },
    scores: {
      weekAverage: payload.weekAverageScore,
      recentAverage: payload.recentAverageScore,
      latest: payload.latestScore,
    },
    bestRecipe: payload.bestRecipe,
    trend: payload.trend,
    updatedAt: payload.updatedAt,
  };
}

function buildPreviewTrend(scores: Array<number | null>): WidgetTrendPoint[] {
  return scores.map((score, index) => ({
    label: `D${index + 1}`,
    cups: score === null ? 0 : 1,
    score,
  }));
}

export function buildWidgetPreviewPayload(
  status: WidgetStatus,
  basePayload?: WidgetPayload
): WidgetPayload {
  const baseBestRecipe =
    basePayload?.bestRecipe ??
    ({
      beanName: "衣索比亞 古吉",
      equipmentName: "V60 02",
      score: 4.3,
      brewedAt: Date.now(),
      ratio: "1:15.5",
    } satisfies WidgetBestRecipe);

  switch (status) {
    case "no_data":
      return {
        status,
        totalCups: 0,
        todayCups: 0,
        weekCups: 0,
        weekAverageScore: null,
        recentAverageScore: null,
        latestScore: null,
        bestRecipe: null,
        trend: buildPreviewTrend([null, null, null, null, null, null, null]),
        updatedAt: null,
      };
    case "insufficient_data":
      return {
        status,
        totalCups: 2,
        todayCups: 1,
        weekCups: 2,
        weekAverageScore: 3.7,
        recentAverageScore: 3.7,
        latestScore: 3.9,
        bestRecipe: {
          ...baseBestRecipe,
          score: 3.9,
        },
        trend: buildPreviewTrend([null, null, 3.4, null, 3.5, null, 3.9]),
        updatedAt: Date.now(),
      };
    case "needs_tweak":
      return {
        status,
        totalCups: 6,
        todayCups: 1,
        weekCups: 4,
        weekAverageScore: 2.9,
        recentAverageScore: 2.7,
        latestScore: 2.6,
        bestRecipe: {
          ...baseBestRecipe,
          score: 3.3,
        },
        trend: buildPreviewTrend([3.4, 3.1, 2.9, 2.8, 2.7, 2.9, 2.6]),
        updatedAt: Date.now(),
      };
    case "hall_of_fame":
      return {
        status,
        totalCups: 9,
        todayCups: 1,
        weekCups: 5,
        weekAverageScore: 4.4,
        recentAverageScore: 4.5,
        latestScore: 4.6,
        bestRecipe: {
          ...baseBestRecipe,
          score: 4.8,
        },
        trend: buildPreviewTrend([4.0, 4.2, 4.1, 4.4, 4.6, 4.5, 4.8]),
        updatedAt: Date.now(),
      };
    case "normal":
    default:
      return {
        status: "normal",
        totalCups: 7,
        todayCups: 1,
        weekCups: 4,
        weekAverageScore: 3.9,
        recentAverageScore: 3.8,
        latestScore: 4.0,
        bestRecipe: baseBestRecipe,
        trend: buildPreviewTrend([3.6, 3.8, 4.0, 3.7, 3.9, 4.1, 4.0]),
        updatedAt: Date.now(),
      };
  }
}
