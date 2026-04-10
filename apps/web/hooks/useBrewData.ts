"use client";

import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Table } from "dexie";
import { db, type LocalBrewContext } from "@/lib/db";
import { getAverageCupScore, type AnalyticsRecord } from "@/lib/data";
import {
  BeanInputSchema,
  BeanSchema,
  BrewLogInputSchema,
  BrewLogSchema,
  EquipmentInputSchema,
  EquipmentSchema,
  type Bean,
  type BeanInput,
  type BrewLog,
  type BrewLogInput,
  type Equipment,
  type EquipmentInput,
  type SyncStatus,
} from "@/lib/schema";

type BrewLogPatch = Partial<BrewLogInput>;
type BeanPatch = Partial<BeanInput>;
type EquipmentPatch = Partial<EquipmentInput>;

type BrewLogWithRelations = BrewLog & {
  bean: Bean | null;
  equipment: Equipment | null;
  grinder: Equipment | null;
  filter: Equipment | null;
};

const BrewLogUpdateSchema = BrewLogInputSchema.partial().strict();
const BeanUpdateSchema = BeanInputSchema.partial().strict();
const EquipmentUpdateSchema = EquipmentInputSchema.partial().strict();

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? uuidv4();
}

function createBaseEntity() {
  const now = Date.now();

  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: "local" as SyncStatus,
  };
}

function ensurePatchHasKeys<T extends object>(patch: T, label: string) {
  if (Object.keys(patch).length === 0) {
    throw new Error(`${label} 至少需要一個可更新欄位。`);
  }
}

function resolveUpdatedSyncStatus(status: SyncStatus) {
  if (status === "synced") {
    return "pending_update" as const;
  }

  if (status === "pending_delete") {
    return "pending_update" as const;
  }

  return "local" as const;
}

function resolveRestoreSyncStatus(status: SyncStatus) {
  if (status === "pending_delete") {
    return "pending_update" as const;
  }

  return status;
}

async function updateEntity<T extends { id: string; updatedAt: number; deletedAt: number | null; syncStatus: SyncStatus }>(
  table: Table<T, string>,
  id: string,
  patch: Partial<T>
) {
  const current = await table.get(id);

  if (!current || current.deletedAt !== null) {
    throw new Error("找不到可更新的資料。");
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
    syncStatus: resolveUpdatedSyncStatus(current.syncStatus),
  } as T;

  await table.put(next);
  return next;
}

async function deleteEntity<T extends { id: string; updatedAt: number; deletedAt: number | null; syncStatus: SyncStatus }>(
  table: Table<T, string>,
  id: string
) {
  const current = await table.get(id);

  if (!current) {
    throw new Error("找不到可刪除的資料。");
  }

  if (current.syncStatus === "local") {
    await table.delete(id);
    return null;
  }

  const next = {
    ...current,
    deletedAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: "pending_delete" as const,
  } as T;

  await table.put(next);
  return next;
}

async function restoreEntity<T extends { id: string; updatedAt: number; deletedAt: number | null; syncStatus: SyncStatus }>(
  table: Table<T, string>,
  id: string
) {
  const current = await table.get(id);

  if (!current || current.deletedAt === null) {
    throw new Error("找不到可復原的資料。");
  }

  const next = {
    ...current,
    deletedAt: null,
    updatedAt: Date.now(),
    syncStatus: resolveRestoreSyncStatus(current.syncStatus),
  } as T;

  await table.put(next);
  return next;
}

export async function addBean(input: BeanInput): Promise<Bean> {
  const parsedInput = BeanInputSchema.parse(input);
  const bean = BeanSchema.parse({
    ...createBaseEntity(),
    ...parsedInput,
    notes: parsedInput.notes ?? null,
  });

  await db.beansV2.add(bean);
  return bean;
}

export async function updateBean(id: string, patch: BeanPatch): Promise<Bean> {
  const parsedPatch = BeanUpdateSchema.parse(patch);
  ensurePatchHasKeys(parsedPatch, "咖啡豆更新");
  const next = await updateEntity(db.beansV2, id, parsedPatch);
  return BeanSchema.parse(next);
}

export async function deleteBean(id: string) {
  const result = await deleteEntity(db.beansV2, id);
  return result ? BeanSchema.parse(result) : null;
}

export async function restoreBean(id: string): Promise<Bean> {
  const next = await restoreEntity(db.beansV2, id);
  return BeanSchema.parse(next);
}

export async function addEquipment(input: EquipmentInput): Promise<Equipment> {
  const parsedInput = EquipmentInputSchema.parse(input);
  const equipment = EquipmentSchema.parse({
    ...createBaseEntity(),
    ...parsedInput,
    brand: parsedInput.brand ?? null,
  });

  await db.equipmentsV2.add(equipment);
  return equipment;
}

export async function updateEquipment(
  id: string,
  patch: EquipmentPatch
): Promise<Equipment> {
  const parsedPatch = EquipmentUpdateSchema.parse(patch);
  ensurePatchHasKeys(parsedPatch, "器具更新");
  const next = await updateEntity(db.equipmentsV2, id, parsedPatch);
  return EquipmentSchema.parse(next);
}

export async function deleteEquipment(id: string) {
  const result = await deleteEntity(db.equipmentsV2, id);
  return result ? EquipmentSchema.parse(result) : null;
}

export async function restoreEquipment(id: string): Promise<Equipment> {
  const next = await restoreEntity(db.equipmentsV2, id);
  return EquipmentSchema.parse(next);
}

export async function addBrewLog(input: BrewLogInput): Promise<BrewLog> {
  const parsedInput = BrewLogInputSchema.parse(input);
  const brewLog = BrewLogSchema.parse({
    ...createBaseEntity(),
    ...parsedInput,
    grinderId: parsedInput.grinderId ?? null,
    filterId: parsedInput.filterId ?? null,
    grindSize: parsedInput.grindSize ?? null,
    bloomTime: parsedInput.bloomTime ?? null,
    feedback: parsedInput.feedback ?? null,
  });

  await db.brewRecordsV2.add(brewLog);
  return brewLog;
}

export async function updateBrewLog(
  id: string,
  patch: BrewLogPatch
): Promise<BrewLog> {
  const parsedPatch = BrewLogUpdateSchema.parse(patch);
  ensurePatchHasKeys(parsedPatch, "沖煮紀錄更新");
  const next = await updateEntity(db.brewRecordsV2, id, parsedPatch);
  return BrewLogSchema.parse(next);
}

export async function deleteBrewLog(id: string) {
  const result = await deleteEntity(db.brewRecordsV2, id);
  return result ? BrewLogSchema.parse(result) : null;
}

export async function restoreBrewLog(id: string): Promise<BrewLog> {
  const next = await restoreEntity(db.brewRecordsV2, id);
  return BrewLogSchema.parse(next);
}

export async function getActiveBeans(): Promise<Bean[]> {
  const beans = await db.beansV2.orderBy("createdAt").reverse().toArray();
  return beans.filter((bean) => bean.deletedAt === null).map((bean) => BeanSchema.parse(bean));
}

export async function getActiveEquipments(): Promise<Equipment[]> {
  const equipments = await db.equipmentsV2.orderBy("createdAt").reverse().toArray();
  return equipments
    .filter((equipment) => equipment.deletedAt === null)
    .map((equipment) => EquipmentSchema.parse(equipment));
}

export async function getActiveBrewLogs(): Promise<BrewLog[]> {
  const brewLogs = await db.brewRecordsV2.orderBy("createdAt").reverse().toArray();
  return brewLogs
    .filter((record) => record.deletedAt === null)
    .map((record) => BrewLogSchema.parse(record));
}

export async function getBrewLogsByDateRange(
  start: number,
  end: number
): Promise<BrewLog[]> {
  const brewLogs = await db.brewRecordsV2
    .where("createdAt")
    .between(start, end, true, true)
    .reverse()
    .toArray();

  return brewLogs
    .filter((record) => record.deletedAt === null)
    .map((record) => BrewLogSchema.parse(record));
}

export async function getActiveBrewLogRelations(): Promise<BrewLogWithRelations[]> {
  const [records, beans, equipments] = await Promise.all([
    getActiveBrewLogs(),
    getActiveBeans(),
    getActiveEquipments(),
  ]);

  const beanMap = new Map<string, Bean>(beans.map((bean) => [bean.id, bean]));
  const equipmentMap = new Map<string, Equipment>(
    equipments.map((equipment) => [equipment.id, equipment])
  );

  return records.map((record) => ({
    ...record,
    bean: beanMap.get(record.beanId) ?? null,
    equipment: equipmentMap.get(record.equipmentId) ?? null,
    grinder: record.grinderId ? equipmentMap.get(record.grinderId) ?? null : null,
    filter: record.filterId ? equipmentMap.get(record.filterId) ?? null : null,
  }));
}

export async function getActiveAnalyticsRecords(): Promise<AnalyticsRecord[]> {
  const records = await getActiveBrewLogRelations();

  return records.map((record) => ({
    ...record,
    score: getAverageCupScore(record),
  }));
}

export async function getActiveBrewLogContext(
  id: string
): Promise<LocalBrewContext | null> {
  const [record, beans, equipments] = await Promise.all([
    db.brewRecordsV2.get(id),
    getActiveBeans(),
    getActiveEquipments(),
  ]);

  if (!record || record.deletedAt !== null) {
    return null;
  }

  const beanMap = new Map<string, Bean>(beans.map((bean) => [bean.id, bean]));
  const equipmentMap = new Map<string, Equipment>(
    equipments.map((equipment) => [equipment.id, equipment])
  );

  return {
    record: BrewLogSchema.parse(record),
    bean: beanMap.get(record.beanId) ?? null,
    equipment: equipmentMap.get(record.equipmentId) ?? null,
    grinder: record.grinderId ? equipmentMap.get(record.grinderId) ?? null : null,
    filter: record.filterId ? equipmentMap.get(record.filterId) ?? null : null,
  };
}

export function useBrewData() {
  return useMemo(
    () => ({
      addBean,
      updateBean,
      deleteBean,
      restoreBean,
      addEquipment,
      updateEquipment,
      deleteEquipment,
      restoreEquipment,
      addBrewLog,
      updateBrewLog,
      deleteBrewLog,
      restoreBrewLog,
      getActiveBeans,
      getActiveEquipments,
      getActiveBrewLogs,
      getBrewLogsByDateRange,
      getActiveBrewLogRelations,
      getActiveAnalyticsRecords,
      getActiveBrewLogContext,
    }),
    []
  );
}
