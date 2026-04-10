import { describe, expect, it } from "vitest";
import { parseBackupPayload } from "../lib/backup";

async function createChecksum(data: unknown) {
  const normalizedJson = JSON.stringify(data);
  const encoded = new TextEncoder().encode(normalizedJson);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createValidPayloadJson() {
  const now = Date.now();
  const beanId = "11111111-1111-4111-8111-111111111111";
  const equipmentId = "22222222-2222-4222-8222-222222222222";
  const recordId = "33333333-3333-4333-8333-333333333333";

  const data = {
    beans: [
      {
        id: beanId,
        name: "Ethiopia Guji",
        origin: "Ethiopia",
        roastLevel: "Light",
        process: "Washed",
        notes: "floral",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "local",
      },
    ],
    equipment: [
      {
        id: equipmentId,
        name: "V60 02",
        type: "濾杯",
        brand: "Hario",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "local",
      },
    ],
    records: [
      {
        id: recordId,
        beanId,
        equipmentId,
        grinderId: null,
        filterId: null,
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
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "local",
      },
    ],
  };

  const payload = {
    app: "CoffeeLog",
    schemaVersion: 3,
    exportedAt: new Date(now).toISOString(),
    checksum: await createChecksum(data),
    data,
  };

  return JSON.stringify(payload);
}

describe("parseBackupPayload", () => {
  it("rejects malformed JSON", async () => {
    await expect(
      parseBackupPayload('{"app":"CoffeeLog","schemaVersion":3')
    ).rejects.toThrow("備份檔不是有效的 JSON 格式。");
  });

  it("rejects schema-invalid records", async () => {
    const validJson = await createValidPayloadJson();
    const payload = JSON.parse(validJson) as {
      app: string;
      schemaVersion: number;
      exportedAt: string;
      checksum: string;
      data: {
        beans: unknown[];
        equipment: unknown[];
        records: Array<Record<string, unknown>>;
      };
    };

    payload.data.records[0] = {
      ...payload.data.records[0],
      beanId: undefined,
    };
    payload.checksum = await createChecksum(payload.data);

    await expect(parseBackupPayload(JSON.stringify(payload))).rejects.toThrow(
      /records\[0\].*格式不正確/
    );
  });

  it("rejects tampered payloads with mismatched checksum", async () => {
    const validJson = await createValidPayloadJson();
    const payload = JSON.parse(validJson) as {
      app: string;
      schemaVersion: number;
      exportedAt: string;
      checksum: string;
      data: {
        beans: Array<Record<string, unknown>>;
        equipment: unknown[];
        records: unknown[];
      };
    };

    payload.data.beans[0] = {
      ...payload.data.beans[0],
      name: "Tampered Bean",
    };

    await expect(parseBackupPayload(JSON.stringify(payload))).rejects.toThrow(
      "備份檔案已損毀或遭到修改，拒絕匯入。"
    );
  });
});
