"use client";

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  db,
  type BrewRecord,
  type CoffeeBean,
  type Equipment,
} from "@/lib/db";
import { BeanSchema, BrewLogSchema, EquipmentSchema } from "@/lib/schema";

const BACKUP_SCHEMA_VERSION = 3;

type BackupData = {
  beans: CoffeeBean[];
  equipment: Equipment[];
  records: BrewRecord[];
};

export type BackupPayload = {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  data: BackupData;
};

function formatBackupDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`備份檔中的 ${fieldName} 欄位格式不正確。`);
  }

  return value;
}

function ensureNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`備份檔中的 ${fieldName} 欄位格式不正確。`);
  }

  return value;
}

function ensureNullableString(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return null;
  }

  return ensureString(value, fieldName);
}

function ensureNullableNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return null;
  }

  return ensureNumber(value, fieldName);
}

function ensureSyncStatus(value: unknown, fieldName: string) {
  if (
    value === undefined ||
    value === null ||
    value === "local" ||
    value === "synced" ||
    value === "pending_update" ||
    value === "pending_delete"
  ) {
    return (value ?? "local") as CoffeeBean["syncStatus"];
  }

  throw new Error(`備份檔中的 ${fieldName} 欄位格式不正確。`);
}

function formatSchemaPath(path: PropertyKey[]) {
  if (path.length === 0) {
    return "根節點";
  }

    return path
    .map((segment) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }

      if (typeof segment === "symbol") {
        return `.${String(segment)}`;
      }

      return `.${segment}`;
    })
    .join("")
    .replace(/^\./, "");
}

function validateCoffeeBean(value: unknown, index: number): CoffeeBean {
  const result = BeanSchema.safeParse(value);

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `備份檔中的 beans[${index}] 欄位格式不正確：${formatSchemaPath(issue?.path ?? [])}`
    );
  }

  return result.data;
}

function validateEquipment(value: unknown, index: number): Equipment {
  const result = EquipmentSchema.safeParse(value);

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `備份檔中的 equipment[${index}] 欄位格式不正確：${formatSchemaPath(issue?.path ?? [])}`
    );
  }

  return result.data;
}

function validateBrewRecord(value: unknown, index: number): BrewRecord {
  const result = BrewLogSchema.safeParse(value);

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `備份檔中的 records[${index}] 欄位格式不正確：${formatSchemaPath(issue?.path ?? [])}`
    );
  }

  return result.data;
}

function normalizeBackupData(candidate: Record<string, unknown>) {
  const equipmentSource = candidate.equipment ?? candidate.equipments;

  if (
    !Array.isArray(candidate.beans) ||
    !Array.isArray(equipmentSource) ||
    !Array.isArray(candidate.records)
  ) {
    throw new Error("備份檔缺少完整的 beans、equipment 或 records 陣列。");
  }

  return {
    beans: candidate.beans.map((bean, index) => validateCoffeeBean(bean, index)),
    equipment: equipmentSource.map((item, index) =>
      validateEquipment(item, index)
    ),
    records: candidate.records.map((record, index) =>
      validateBrewRecord(record, index)
    ),
  } satisfies BackupData;
}

async function createChecksum(data: BackupData) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("目前裝置不支援備份完整性驗證，請更新系統後再試。");
  }

  const normalizedJson = JSON.stringify(data);
  const encoded = new TextEncoder().encode(normalizedJson);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getBackupFilename(date = new Date()) {
  return `coffeelog_backup_${formatBackupDate(date)}.json`;
}

export async function exportDatabase() {
  const [beans, equipment, records] = await Promise.all([
    db.beansV2.toArray(),
    db.equipmentsV2.toArray(),
    db.brewRecordsV2.toArray(),
  ]);

  const data = {
    beans,
    equipment,
    records,
  } satisfies BackupData;

  const payload = {
    app: "CoffeeLog",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    checksum: await createChecksum(data),
    data,
  } satisfies BackupPayload;

  const json = JSON.stringify(payload, null, 2);
  const filename = getBackupFilename();

  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    await Share.share({
      title: "CoffeeLog 備份",
      text: "匯出 CoffeeLog 本地資料備份",
      url: file.uri,
      dialogTitle: "匯出備份",
    });

    return { filename, mode: "native" as const };
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { filename, mode: "web" as const };
}

export async function parseBackupPayload(json: string): Promise<BackupPayload> {
  let payload: unknown;

  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error("備份檔不是有效的 JSON 格式。");
  }

  if (!isPlainObject(payload)) {
    throw new Error("備份檔內容格式不正確。");
  }

  const schemaVersion = payload.schemaVersion;
  if (typeof schemaVersion !== "number") {
    throw new Error("備份檔缺少 schemaVersion，無法確認格式。");
  }

  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `這份備份來自較新的版本 (${schemaVersion})，目前版本尚不支援還原。`
    );
  }

  if (schemaVersion < BACKUP_SCHEMA_VERSION) {
    throw new Error("這份備份格式過舊，請使用最新版 CoffeeLog 重新匯出。");
  }

  if (typeof payload.checksum !== "string" || payload.checksum.length === 0) {
    throw new Error("備份檔缺少 checksum，無法驗證資料完整性。");
  }

  if (!isPlainObject(payload.data)) {
    throw new Error("備份檔缺少完整的 data 區塊。");
  }

  const data = normalizeBackupData(payload.data);
  const calculatedChecksum = await createChecksum(data);

  if (calculatedChecksum !== payload.checksum) {
    throw new Error("備份檔案已損毀或遭到修改，拒絕匯入。");
  }

  return {
    app: typeof payload.app === "string" ? payload.app : "CoffeeLog",
    schemaVersion,
    exportedAt:
      typeof payload.exportedAt === "string"
        ? payload.exportedAt
        : new Date(0).toISOString(),
    checksum: payload.checksum,
    data,
  };
}

export function getBackupSummary(payload: BackupPayload) {
  return {
    beans: payload.data.beans.length,
    equipment: payload.data.equipment.length,
    records: payload.data.records.length,
  };
}

export async function importDatabase(source: string | BackupPayload) {
  const payload =
    typeof source === "string" ? await parseBackupPayload(source) : source;
  const { beans, equipment, records } = payload.data;

  await db.transaction(
    "rw",
    db.beansV2,
    db.equipmentsV2,
    db.brewRecordsV2,
    async () => {
      if (beans.length > 0) {
        await db.beansV2.bulkPut(beans);
      }

      if (equipment.length > 0) {
        await db.equipmentsV2.bulkPut(equipment);
      }

      if (records.length > 0) {
        await db.brewRecordsV2.bulkPut(records);
      }
    }
  );

  return {
    beans: beans.length,
    equipment: equipment.length,
    records: records.length,
  };
}

export async function clearDatabase() {
  await db.transaction(
    "rw",
    db.beansV2,
    db.equipmentsV2,
    db.brewRecordsV2,
    async () => {
      await Promise.all([
        db.brewRecordsV2.clear(),
        db.beansV2.clear(),
        db.equipmentsV2.clear(),
      ]);
    }
  );
}
