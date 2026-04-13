import Dexie, { type Table, type Transaction } from "dexie";
import {
  type Bean as CoffeeBean,
  type BrewLog as BrewRecord,
  type Equipment,
} from "@/lib/schema";
import { normalizeBeanRecord } from "@/lib/bean-normalization";
export type { CoffeeBean, Equipment, BrewRecord };

export type LocalBrewContext = {
  record: BrewRecord;
  bean: CoffeeBean | null;
  equipment: Equipment | null;
  grinder: Equipment | null;
  filter: Equipment | null;
};

type LegacyCoffeeBean = {
  id?: number;
  name: string;
  origin: string;
  roastLevel: string;
  process: string;
  notes?: string | null;
  createdAt: number;
};

type LegacyEquipment = {
  id?: number;
  name: string;
  type: string;
  brand?: string | null;
  createdAt: number;
};

type LegacyBrewRecord = {
  id?: number;
  beanId: number;
  dose: number;
  water: number;
  temperature: number;
  equipment: string;
  brewTime: number;
  grindSize?: string | null;
  bloomTime?: number | null;
  acidity: number;
  sweetness: number;
  body: number;
  bitterness: number;
  feedback?: string | null;
  createdAt: number;
};

type BrewRecordV3Compat = BrewRecord & {
  grinderId?: string | null;
  filterId?: string | null;
};

type LegacySensoryRating = Partial<
  Record<"acidity" | "sweetness" | "body" | "bitterness", number>
>;

type BrewRecordV7Compat = Partial<BrewRecord> & {
  id: string;
  dose: number;
  inventoryDeductedGrams?: number;
  rating?: LegacySensoryRating | null;
  acidity?: number;
  sweetness?: number;
  body?: number;
  bitterness?: number;
};

type BeanV4Compat = Partial<CoffeeBean> & {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  syncStatus?: CoffeeBean["syncStatus"];
};

function resolveSensoryValue(
  currentValue: unknown,
  legacyValue: unknown,
  fallback = 3
) {
  if (typeof currentValue === "number" && Number.isFinite(currentValue)) {
    return currentValue;
  }

  if (typeof legacyValue === "number" && Number.isFinite(legacyValue)) {
    return legacyValue;
  }

  return fallback;
}

async function backfillBrewRecordInventoryAndSensory(
  tx: Transaction
) {
  const brewRecords = (await tx
    .table("brewRecordsV2")
    .toArray()) as BrewRecordV7Compat[];

  await tx.table("brewRecordsV2").bulkPut(
    brewRecords.map((record) => {
      const legacyRating =
        typeof record.rating === "object" && record.rating !== null
          ? record.rating
          : null;

      return {
        ...record,
        acidity: resolveSensoryValue(
          record.acidity,
          legacyRating?.acidity
        ),
        sweetness: resolveSensoryValue(
          record.sweetness,
          legacyRating?.sweetness
        ),
        body: resolveSensoryValue(
          record.body,
          legacyRating?.body
        ),
        bitterness: resolveSensoryValue(
          record.bitterness,
          legacyRating?.bitterness
        ),
        inventoryDeductedGrams:
          record.inventoryDeductedGrams ?? record.dose,
      };
    })
  );
}

class CoffeeLogDB extends Dexie {
  beansV2!: Table<CoffeeBean, string>;
  equipmentsV2!: Table<Equipment, string>;
  brewRecordsV2!: Table<BrewRecord, string>;

  constructor() {
    super("CoffeeLogDB");

    this.version(1).stores({
      coffeeBeans: "++id, createdAt, name, origin",
      equipment: "++id, createdAt, type, name",
      brewRecords: "++id, createdAt, beanId, equipment",
    });

    this.version(2).stores({
      beansV2: "id, createdAt, updatedAt, name, origin",
      equipmentsV2: "id, createdAt, updatedAt, type, name",
      brewRecordsV2: "id, createdAt, updatedAt, beanId, equipmentId",
    }).upgrade(async (tx) => {
      const [legacyBeans, legacyEquipments, legacyBrewRecords] = await Promise.all([
        tx.table("coffeeBeans").toArray() as Promise<LegacyCoffeeBean[]>,
        tx.table("equipment").toArray() as Promise<LegacyEquipment[]>,
        tx.table("brewRecords").toArray() as Promise<LegacyBrewRecord[]>,
      ]);

      const beanIdMap = new Map<number, string>();
      const equipmentNameMap = new Map<string, string>();

      const beansV2: CoffeeBean[] = legacyBeans.map((bean) => {
        const id = crypto.randomUUID();

        if (typeof bean.id === "number") {
          beanIdMap.set(bean.id, id);
        }

        return {
          id,
          name: bean.name,
          origin: bean.origin,
          roastLevel: bean.roastLevel,
          process: bean.process,
          notes: bean.notes ?? null,
          totalWeight: 0,
          remainingWeight: 0,
          status: "ACTIVE",
          roastDate: new Date(bean.createdAt).toISOString(),
          createdAt: bean.createdAt,
          updatedAt: bean.createdAt,
          deletedAt: null,
          syncStatus: "local",
        };
      });

      const equipmentsV2: Equipment[] = legacyEquipments.map((equipment) => {
        const id = crypto.randomUUID();

        equipmentNameMap.set(equipment.name, id);

        return {
          id,
          name: equipment.name,
          type: equipment.type,
          brand: equipment.brand ?? null,
          createdAt: equipment.createdAt,
          updatedAt: equipment.createdAt,
          deletedAt: null,
          syncStatus: "local",
        };
      });

      const brewRecordsV2: BrewRecord[] = legacyBrewRecords.flatMap((record) => {
        const beanId = beanIdMap.get(record.beanId);
        const equipmentId = equipmentNameMap.get(record.equipment);

        if (!beanId || !equipmentId) {
          return [];
        }

        return [
          {
            id: crypto.randomUUID(),
            beanId,
            equipmentId,
            grinderId: null,
            filterId: null,
            dose: record.dose,
            water: record.water,
            temperature: record.temperature,
            brewTime: record.brewTime,
            grindSize: record.grindSize ?? null,
            bloomTime: record.bloomTime ?? null,
            acidity: record.acidity,
            sweetness: record.sweetness,
            body: record.body,
            bitterness: record.bitterness,
            feedback: record.feedback ?? null,
            createdAt: record.createdAt,
            updatedAt: record.createdAt,
            deletedAt: null,
            syncStatus: "local",
          },
        ];
      });

      await Promise.all([
        tx.table("beansV2").bulkPut(beansV2),
        tx.table("equipmentsV2").bulkPut(equipmentsV2),
        tx.table("brewRecordsV2").bulkPut(brewRecordsV2),
      ]);
    });

    this.version(3)
      .stores({
        beansV2: "&id, createdAt, updatedAt, deletedAt, syncStatus",
        equipmentsV2: "&id, createdAt, updatedAt, deletedAt, syncStatus, type",
        brewRecordsV2:
          "&id, beanId, equipmentId, createdAt, updatedAt, deletedAt, syncStatus",
      })
      .upgrade(async (tx) => {
        const [beans, equipments, brewRecords] = await Promise.all([
          tx.table("beansV2").toArray() as Promise<Array<CoffeeBean & { deletedAt?: number | null; syncStatus?: string }>>,
          tx.table("equipmentsV2").toArray() as Promise<Array<Equipment & { deletedAt?: number | null; syncStatus?: string }>>,
          tx.table("brewRecordsV2").toArray() as Promise<Array<BrewRecord & { deletedAt?: number | null; syncStatus?: string }>>,
        ]);

        await Promise.all([
          tx.table("beansV2").bulkPut(
            beans.map((bean) => ({
              ...bean,
              deletedAt: bean.deletedAt ?? null,
              syncStatus: bean.syncStatus ?? "local",
            }))
          ),
          tx.table("equipmentsV2").bulkPut(
            equipments.map((equipment) => ({
              ...equipment,
              deletedAt: equipment.deletedAt ?? null,
              syncStatus: equipment.syncStatus ?? "local",
            }))
          ),
          tx.table("brewRecordsV2").bulkPut(
            brewRecords.map((record) => ({
              ...record,
              deletedAt: record.deletedAt ?? null,
              syncStatus: record.syncStatus ?? "local",
            }))
          ),
        ]);
      });

    this.version(4)
      .stores({
        beansV2: "&id, createdAt, updatedAt, deletedAt, syncStatus",
        equipmentsV2: "&id, createdAt, updatedAt, deletedAt, syncStatus, type",
        brewRecordsV2:
          "&id, beanId, equipmentId, grinderId, filterId, createdAt, updatedAt, deletedAt, syncStatus",
      })
      .upgrade(async (tx) => {
        const brewRecords = (await tx
          .table("brewRecordsV2")
          .toArray()) as BrewRecordV3Compat[];

        await tx.table("brewRecordsV2").bulkPut(
          brewRecords.map((record) => ({
            ...record,
            grinderId: record.grinderId ?? null,
            filterId: record.filterId ?? null,
          }))
        );
      });

    this.version(5)
      .stores({
        beansV2:
          "&id, createdAt, updatedAt, deletedAt, syncStatus, status, roastDate, peakDate",
        equipmentsV2: "&id, createdAt, updatedAt, deletedAt, syncStatus, type",
        brewRecordsV2:
          "&id, beanId, equipmentId, grinderId, filterId, createdAt, updatedAt, deletedAt, syncStatus",
      })
      .upgrade(async (tx) => {
        const beans = (await tx.table("beansV2").toArray()) as BeanV4Compat[];

        await tx.table("beansV2").bulkPut(
          beans.map((bean) => normalizeBeanRecord(bean))
        );
      });

    this.version(6)
      .stores({
        beansV2:
          "&id, createdAt, updatedAt, deletedAt, syncStatus, status, roastDate, peakDate",
        equipmentsV2: "&id, createdAt, updatedAt, deletedAt, syncStatus, type",
        brewRecordsV2:
          "&id, beanId, equipmentId, grinderId, filterId, createdAt, updatedAt, deletedAt, syncStatus",
      })
      .upgrade(async (tx) => {
        const beans = (await tx.table("beansV2").toArray()) as BeanV4Compat[];

        await tx.table("beansV2").bulkPut(
          beans.map((bean) => normalizeBeanRecord(bean))
        );
      });

    this.version(7)
      .stores({
        beansV2:
          "&id, createdAt, updatedAt, deletedAt, syncStatus, status, roastDate, peakDate",
        equipmentsV2: "&id, createdAt, updatedAt, deletedAt, syncStatus, type",
        brewRecordsV2:
          "&id, beanId, equipmentId, grinderId, filterId, createdAt, updatedAt, deletedAt, syncStatus",
      })
      .upgrade(backfillBrewRecordInventoryAndSensory);

    this.version(8)
      .stores({
        beansV2:
          "&id, createdAt, updatedAt, deletedAt, syncStatus, status, roastDate, peakDate",
        equipmentsV2: "&id, createdAt, updatedAt, deletedAt, syncStatus, type",
        brewRecordsV2:
          "&id, beanId, equipmentId, grinderId, filterId, createdAt, updatedAt, deletedAt, syncStatus",
      })
      .upgrade(backfillBrewRecordInventoryAndSensory);
  }
}

export const db = new CoffeeLogDB();
