import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import {
  addBean,
  addBrewLog,
  addEquipment,
  deleteBean,
  deleteBrewLog,
  getActiveBeans,
  getActiveBrewLogs,
  restoreBean,
  restoreBrewLog,
  updateBrewLog,
} from "../hooks/useBrewData";

async function createFixture() {
  const bean = await addBean({
    name: "Ethiopia Guji",
    origin: "Ethiopia",
    roastLevel: "Light",
    process: "Washed",
    notes: "floral",
  });
  const equipment = await addEquipment({
    name: "V60 02",
    type: "濾杯",
    brand: "Hario",
  });

  return { bean, equipment };
}

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe("useBrewData lifecycle", () => {
  it("creates a brew log with local-first metadata", async () => {
    const { bean, equipment } = await createFixture();

    const brew = await addBrewLog({
      beanId: bean.id,
      equipmentId: equipment.id,
      dose: 15,
      water: 250,
      temperature: 92,
      brewTime: 150,
      grindSize: "24 clicks",
      bloomTime: 30,
      acidity: 4,
      sweetness: 4,
      body: 3,
      bitterness: 2,
      feedback: "clean",
    });

    expect(brew.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(brew.syncStatus).toBe("local");
    expect(brew.deletedAt).toBeNull();
    expect(brew.updatedAt).toBe(brew.createdAt);
  });

  it("updates local records without leaving local state", async () => {
    const { bean, equipment } = await createFixture();
    const brew = await addBrewLog({
      beanId: bean.id,
      equipmentId: equipment.id,
      dose: 15,
      water: 250,
      temperature: 92,
      brewTime: 150,
      grindSize: null,
      bloomTime: null,
      acidity: 3,
      sweetness: 3,
      body: 3,
      bitterness: 3,
      feedback: null,
    });

    const updated = await updateBrewLog(brew.id, {
      water: 260,
      sweetness: 4,
    });

    expect(updated.water).toBe(260);
    expect(updated.sweetness).toBe(4);
    expect(updated.syncStatus).toBe("local");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(brew.updatedAt);
  });

  it("promotes synced records to pending_update and filters soft-deleted records", async () => {
    const { bean, equipment } = await createFixture();
    const brew = await addBrewLog({
      beanId: bean.id,
      equipmentId: equipment.id,
      dose: 18,
      water: 280,
      temperature: 93,
      brewTime: 165,
      grindSize: "medium",
      bloomTime: 35,
      acidity: 4,
      sweetness: 4,
      body: 4,
      bitterness: 2,
      feedback: "balanced",
    });

    await db.brewRecordsV2.put({
      ...brew,
      syncStatus: "synced",
    });

    const updated = await updateBrewLog(brew.id, {
      feedback: "adjusted",
    });
    expect(updated.syncStatus).toBe("pending_update");

    const deleted = await deleteBrewLog(brew.id);
    expect(deleted?.syncStatus).toBe("pending_delete");
    expect(deleted?.deletedAt).not.toBeNull();

    const activeRecords = await getActiveBrewLogs();
    expect(activeRecords).toHaveLength(0);
  });

  it("hard deletes local records and restores pending_delete records as pending_update", async () => {
    const { bean, equipment } = await createFixture();
    const localBrew = await addBrewLog({
      beanId: bean.id,
      equipmentId: equipment.id,
      dose: 16,
      water: 240,
      temperature: 91,
      brewTime: 145,
      grindSize: null,
      bloomTime: null,
      acidity: 3,
      sweetness: 4,
      body: 3,
      bitterness: 2,
      feedback: null,
    });

    const deleteResult = await deleteBrewLog(localBrew.id);
    expect(deleteResult).toBeNull();
    expect(await db.brewRecordsV2.get(localBrew.id)).toBeUndefined();

    const syncedBrew = await addBrewLog({
      beanId: bean.id,
      equipmentId: equipment.id,
      dose: 18,
      water: 300,
      temperature: 94,
      brewTime: 170,
      grindSize: "medium-fine",
      bloomTime: 40,
      acidity: 4,
      sweetness: 5,
      body: 4,
      bitterness: 2,
      feedback: "sweet",
    });

    await db.brewRecordsV2.put({
      ...syncedBrew,
      syncStatus: "synced",
    });

    await deleteBrewLog(syncedBrew.id);
    const restored = await restoreBrewLog(syncedBrew.id);

    expect(restored.deletedAt).toBeNull();
    expect(restored.syncStatus).toBe("pending_update");
    expect((await getActiveBrewLogs()).map((record) => record.id)).toContain(
      syncedBrew.id
    );
  });

  it("applies the same lifecycle boundary to beans", async () => {
    const bean = await addBean({
      name: "Kenya AA",
      origin: "Kenya",
      roastLevel: "Medium",
      process: "Washed",
      notes: null,
    });

    await db.beansV2.put({
      ...bean,
      syncStatus: "synced",
    });

    const deleted = await deleteBean(bean.id);
    expect(deleted?.syncStatus).toBe("pending_delete");

    const activeBeans = await getActiveBeans();
    expect(activeBeans).toHaveLength(0);

    const restored = await restoreBean(bean.id);
    expect(restored.syncStatus).toBe("pending_update");
    expect((await getActiveBeans()).map((item) => item.id)).toContain(bean.id);
  });
});
