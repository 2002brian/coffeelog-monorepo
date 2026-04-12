"use client";

import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Table } from "dexie";
import { normalizeBeanRecord } from "@/lib/bean-normalization";
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

function getInventoryDeductedGrams(record: Pick<BrewLog, "dose"> & Partial<Pick<BrewLog, "inventoryDeductedGrams">>) {
  return record.inventoryDeductedGrams ?? record.dose;
}

function applyBeanInventoryDelta(
  bean: Bean,
  deltaGrams: number
): Bean {
  const nextRemainingWeight = Math.max(bean.remainingWeight - deltaGrams, 0);

  let nextStatus = bean.status;

  if (nextRemainingWeight <= 0) {
    nextStatus = "ARCHIVED";
  } else if (deltaGrams > 0 && bean.status === "RESTING") {
    nextStatus = "ACTIVE";
  } else if (deltaGrams < 0 && bean.status === "ARCHIVED") {
    nextStatus = "ACTIVE";
  }

  return BeanSchema.parse({
    ...bean,
    remainingWeight: nextRemainingWeight,
    status: nextStatus,
    updatedAt: Date.now(),
    syncStatus: "pending_update",
  });
}

async function getBrewRecordOrThrow(id: string) {
  const record = await db.brewRecordsV2.get(id);

  if (!record) {
    throw new Error("找不到可操作的沖煮紀錄。");
  }

  return BrewLogSchema.parse(record);
}

async function getActiveBeanOrThrow(id: string) {
  const bean = await db.beansV2.get(id);

  if (!bean || bean.deletedAt !== null) {
    throw new Error("找不到可操作的咖啡豆。");
  }

  return BeanSchema.parse(bean);
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
  const totalWeight = parsedInput.totalWeight ?? 0;
  const remainingWeight = parsedInput.remainingWeight ?? totalWeight;
  const bean = BeanSchema.parse({
    ...createBaseEntity(),
    ...parsedInput,
    notes: parsedInput.notes ?? null,
    totalWeight,
    remainingWeight,
    status:
      remainingWeight <= 0
        ? "ARCHIVED"
        : parsedInput.status ?? "RESTING",
    roastDate: parsedInput.roastDate ?? new Date().toISOString(),
  });

  await db.beansV2.add(bean);
  return bean;
}

export async function updateBean(id: string, patch: BeanPatch): Promise<Bean> {
  const parsedPatch = BeanUpdateSchema.parse(patch);
  ensurePatchHasKeys(parsedPatch, "咖啡豆更新");
  const next = await updateEntity(db.beansV2, id, parsedPatch);
  return normalizeBeanRecord(next);
}

export async function deleteBean(id: string) {
  const result = await deleteEntity(db.beansV2, id);
  return result ? normalizeBeanRecord(result) : null;
}

export async function restoreBean(id: string): Promise<Bean> {
  const next = await restoreEntity(db.beansV2, id);
  return normalizeBeanRecord(next);
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
  return db.transaction("rw", db.beansV2, db.brewRecordsV2, async () => {
    const bean = await getActiveBeanOrThrow(parsedInput.beanId);
    const brewLog = BrewLogSchema.parse({
      ...createBaseEntity(),
      ...parsedInput,
      grinderId: parsedInput.grinderId ?? null,
      filterId: parsedInput.filterId ?? null,
      inventoryDeductedGrams: parsedInput.dose,
      grindSize: parsedInput.grindSize ?? null,
      bloomTime: parsedInput.bloomTime ?? null,
      feedback: parsedInput.feedback ?? null,
    });

    const updatedBean = applyBeanInventoryDelta(bean, parsedInput.dose);

    await db.beansV2.put(updatedBean);
    await db.brewRecordsV2.add(brewLog);

    return brewLog;
  });
}

export async function updateBrewLog(
  id: string,
  patch: BrewLogPatch
): Promise<BrewLog> {
  const parsedPatch = BrewLogUpdateSchema.parse(patch);
  ensurePatchHasKeys(parsedPatch, "沖煮紀錄更新");

  return db.transaction("rw", db.beansV2, db.brewRecordsV2, async () => {
    const current = await getBrewRecordOrThrow(id);
    if (current.deletedAt !== null) {
      throw new Error("找不到可更新的沖煮紀錄。");
    }

    const nextBeanId = parsedPatch.beanId ?? current.beanId;
    const nextInventoryDeductedGrams = parsedPatch.dose ?? getInventoryDeductedGrams(current);
    const currentInventoryDeductedGrams = getInventoryDeductedGrams(current);
    const syncStatus = resolveUpdatedSyncStatus(current.syncStatus);
    const inventoryChanged =
      nextBeanId !== current.beanId ||
      nextInventoryDeductedGrams !== currentInventoryDeductedGrams;

    const nextRecord = BrewLogSchema.parse({
      ...current,
      ...parsedPatch,
      beanId: nextBeanId,
      grinderId: parsedPatch.grinderId ?? current.grinderId ?? null,
      filterId: parsedPatch.filterId ?? current.filterId ?? null,
      inventoryDeductedGrams: nextInventoryDeductedGrams,
      updatedAt: Date.now(),
      syncStatus,
    });

    const oldBean = await getActiveBeanOrThrow(current.beanId);
    const nextBean =
      nextBeanId === current.beanId
        ? oldBean
        : await getActiveBeanOrThrow(nextBeanId);

    if (inventoryChanged) {
      const refundedOldBean = applyBeanInventoryDelta(
        oldBean,
        -currentInventoryDeductedGrams
      );
      const deductedNextBean =
        nextBeanId === current.beanId
          ? applyBeanInventoryDelta(refundedOldBean, nextInventoryDeductedGrams)
          : applyBeanInventoryDelta(nextBean, nextInventoryDeductedGrams);

      if (nextBeanId === current.beanId) {
        await db.beansV2.put(deductedNextBean);
      } else {
        await db.beansV2.put(refundedOldBean);
        await db.beansV2.put(deductedNextBean);
      }
    }

    await db.brewRecordsV2.put(nextRecord);

    return nextRecord;
  });
}

export async function deleteBrewLog(id: string) {
  return db.transaction("rw", db.beansV2, db.brewRecordsV2, async () => {
    const current = await getBrewRecordOrThrow(id);

    if (current.deletedAt !== null) {
      throw new Error("找不到可刪除的沖煮紀錄。");
    }

    const inventoryDeductedGrams = getInventoryDeductedGrams(current);
    const bean = await getActiveBeanOrThrow(current.beanId);
    const refundedBean = applyBeanInventoryDelta(bean, -inventoryDeductedGrams);

    if (current.syncStatus === "local") {
      await db.beansV2.put(refundedBean);
      await db.brewRecordsV2.delete(id);

      return null;
    }

    const next = BrewLogSchema.parse({
      ...current,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: "pending_delete",
    });

    await db.beansV2.put(refundedBean);
    await db.brewRecordsV2.put(next);

    return next;
  });
}

export async function restoreBrewLog(id: string): Promise<BrewLog> {
  return db.transaction("rw", db.beansV2, db.brewRecordsV2, async () => {
    const current = await db.brewRecordsV2.get(id);

    if (!current || current.deletedAt === null) {
      throw new Error("找不到可復原的沖煮紀錄。");
    }

    const parsedCurrent = BrewLogSchema.parse(current);
    const inventoryDeductedGrams = getInventoryDeductedGrams(parsedCurrent);
    const bean = await getActiveBeanOrThrow(parsedCurrent.beanId);
    const deductedBean = applyBeanInventoryDelta(bean, inventoryDeductedGrams);
    const next = BrewLogSchema.parse({
      ...parsedCurrent,
      deletedAt: null,
      updatedAt: Date.now(),
      syncStatus: resolveRestoreSyncStatus(parsedCurrent.syncStatus),
    });

    await db.beansV2.put(deductedBean);
    await db.brewRecordsV2.put(next);

    return next;
  });
}

export async function getActiveBeans(): Promise<Bean[]> {
  const beans = await db.beansV2.orderBy("createdAt").reverse().toArray();
  return beans
    .filter((bean) => bean.deletedAt === null)
    .map((bean) => normalizeBeanRecord(bean));
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
