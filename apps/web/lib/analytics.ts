import { type AnalyticsRecord } from "@/lib/data";

export type AnalysisState = "ready" | "insufficient_data" | "missing_fields";

export type SweetSpotPoint = {
  id: string;
  x: number;
  y: number;
  rating: number;
  beanName: string;
  equipmentName: string;
  brewedAt: number;
};

export type SweetSpotScatterData = {
  state: AnalysisState;
  points: SweetSpotPoint[];
  xDomain: { min: number; max: number };
  yDomain: { min: number; max: number };
};

export type EquipmentLeaderboardEntry = {
  equipmentName: string;
  averageRating: number;
  sampleCount: number;
};

export type EquipmentLeaderboardData = {
  state: AnalysisState;
  items: EquipmentLeaderboardEntry[];
};

function extractNumericValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundToOne(value: number) {
  return Number(value.toFixed(1));
}

function expandDomain(min: number, max: number) {
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }

  const padding = Math.max(0.5, (max - min) * 0.08);
  return {
    min: roundToOne(min - padding),
    max: roundToOne(max + padding),
  };
}

export function buildSweetSpotScatterData(
  records: AnalyticsRecord[]
): SweetSpotScatterData {
  if (records.length < 3) {
    return {
      state: "insufficient_data",
      points: [],
      xDomain: { min: 0, max: 1 },
      yDomain: { min: 0, max: 1 },
    };
  }

  const points = records.flatMap((record) => {
    const grindValue = extractNumericValue(record.grindSize);
    const temperatureValue = Number(record.temperature);
    const ratingValue = Number(record.score);

    if (
      grindValue === null ||
      !Number.isFinite(temperatureValue) ||
      !Number.isFinite(ratingValue) ||
      ratingValue < 1 ||
      ratingValue > 5
    ) {
      return [];
    }

    return [
      {
        id: record.id,
        x: grindValue,
        y: temperatureValue,
        rating: ratingValue,
        beanName: record.bean?.name ?? "未命名咖啡豆",
        equipmentName: record.equipment?.name ?? "未知器具",
        brewedAt: record.createdAt,
      },
    ];
  });

  if (points.length < 2) {
    return {
      state: "missing_fields",
      points: [],
      xDomain: { min: 0, max: 1 },
      yDomain: { min: 0, max: 1 },
    };
  }

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);

  return {
    state: "ready",
    points,
    xDomain: expandDomain(Math.min(...xValues), Math.max(...xValues)),
    yDomain: expandDomain(Math.min(...yValues), Math.max(...yValues)),
  };
}

export function buildEquipmentLeaderboardData(
  records: AnalyticsRecord[]
): EquipmentLeaderboardData {
  if (records.length < 3) {
    return {
      state: "insufficient_data",
      items: [],
    };
  }

  const buckets = new Map<
    string,
    { equipmentName: string; total: number; sampleCount: number }
  >();

  for (const record of records) {
    const ratingValue = Number(record.score);
    const equipmentName = record.equipment?.name?.trim() ?? "";

    if (!equipmentName || !Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      continue;
    }

    const current = buckets.get(equipmentName) ?? {
      equipmentName,
      total: 0,
      sampleCount: 0,
    };

    current.total += ratingValue;
    current.sampleCount += 1;
    buckets.set(equipmentName, current);
  }

  const items = [...buckets.values()]
    .filter((item) => item.sampleCount >= 2)
    .map((item) => ({
      equipmentName: item.equipmentName,
      averageRating: roundToOne(item.total / item.sampleCount),
      sampleCount: item.sampleCount,
    }))
    .sort((left, right) => {
      if (right.averageRating !== left.averageRating) {
        return right.averageRating - left.averageRating;
      }

      if (right.sampleCount !== left.sampleCount) {
        return right.sampleCount - left.sampleCount;
      }

      return left.equipmentName.localeCompare(right.equipmentName, "zh-Hant");
    })
    .slice(0, 3);

  if (items.length === 0) {
    return {
      state: "missing_fields",
      items: [],
    };
  }

  return {
    state: "ready",
    items,
  };
}
