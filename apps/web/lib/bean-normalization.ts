"use client";

import { BeanSchema, type Bean, type SyncStatus } from "@/lib/schema";

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function toNullableNumber(value: unknown) {
  const parsed = toFiniteNumber(value);
  return parsed === undefined ? null : parsed;
}

function toTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toNullableString(value: unknown) {
  return toTrimmedString(value) ?? null;
}

function normalizeDateTime(value: unknown, fallbackTimestamp: number) {
  const normalizedValue = toTrimmedString(value);

  if (normalizedValue) {
    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue);
    const parsed = new Date(
      dateOnlyMatch ? `${normalizedValue}T12:00:00.000Z` : normalizedValue
    );

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date(fallbackTimestamp).toISOString();
}

function normalizePeakDate(value: unknown) {
  const normalizedValue = toTrimmedString(value);

  if (!normalizedValue) {
    return undefined;
  }

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue);
  const parsed = new Date(
    dateOnlyMatch ? `${normalizedValue}T09:00:00.000Z` : normalizedValue
  );

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function normalizeSyncStatus(value: unknown): SyncStatus {
  if (
    value === "local" ||
    value === "synced" ||
    value === "pending_update" ||
    value === "pending_delete"
  ) {
    return value;
  }

  return "local";
}

function normalizeStatus(value: unknown, remainingWeight: number): Bean["status"] {
  if (
    value === "RESTING" ||
    value === "ACTIVE" ||
    value === "ARCHIVED"
  ) {
    return value;
  }

  return remainingWeight <= 0 ? "ARCHIVED" : "ACTIVE";
}

export function normalizeBeanRecord(value: unknown): Bean {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const createdAt = toFiniteNumber(candidate.createdAt) ?? Date.now();
  const totalWeight =
    toFiniteNumber(candidate.totalWeight) ??
    toFiniteNumber(candidate.weight) ??
    0;
  const remainingWeight =
    toFiniteNumber(candidate.remainingWeight) ??
    totalWeight;

  return BeanSchema.parse({
    id:
      toTrimmedString(candidate.id) ??
      globalThis.crypto?.randomUUID?.() ??
      crypto.randomUUID(),
    createdAt,
    updatedAt: toFiniteNumber(candidate.updatedAt) ?? createdAt,
    deletedAt: toNullableNumber(candidate.deletedAt),
    syncStatus: normalizeSyncStatus(candidate.syncStatus),
    name: toTrimmedString(candidate.name) ?? "",
    origin: toTrimmedString(candidate.origin) ?? "",
    roastLevel: toTrimmedString(candidate.roastLevel) ?? "",
    process: toTrimmedString(candidate.process) ?? "",
    notes: toNullableString(candidate.notes),
    totalWeight: Math.max(totalWeight, 0),
    remainingWeight: Math.max(remainingWeight, 0),
    status: normalizeStatus(candidate.status, remainingWeight),
    roastDate: normalizeDateTime(candidate.roastDate, createdAt),
    peakDate: normalizePeakDate(candidate.peakDate),
  });
}
