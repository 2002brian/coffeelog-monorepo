"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import FormPageHeader from "@/components/FormPageHeader";
import { useBrewData } from "@/hooks/useBrewData";
import {
  triggerLightImpact,
  triggerSuccessNotification,
  triggerWarningNotification,
} from "@/lib/haptics";

const equipmentTypes = ["濾杯", "磨豆機", "濾紙", "手沖壺", "其他"] as const;

function NewEquipmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const equipmentId = searchParams.get("id")?.trim() ?? "";
  const { addEquipment, getActiveEquipments, updateEquipment } = useBrewData();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof equipmentTypes)[number]>("濾杯");
  const [brand, setBrand] = useState("");
  const equipments = useLiveQuery(() => getActiveEquipments(), []);
  const currentEquipment = useMemo(
    () => equipments?.find((equipment) => equipment.id === equipmentId) ?? null,
    [equipments, equipmentId]
  );
  const isEditing = Boolean(equipmentId);

  useEffect(() => {
    if (!currentEquipment) {
      return;
    }

    setName(currentEquipment.name);
    setType(
      equipmentTypes.includes(currentEquipment.type as (typeof equipmentTypes)[number])
        ? (currentEquipment.type as (typeof equipmentTypes)[number])
        : "其他"
    );
    setBrand(currentEquipment.brand ?? "");
  }, [currentEquipment]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const typeValue = type.trim();
    const brandRaw = brand.trim();
    const brandValue = brandRaw.length > 0 ? brandRaw : null;

    if (!trimmedName || !equipmentTypes.includes(typeValue as (typeof equipmentTypes)[number])) {
      setError("請完整填寫器具名稱並選擇正確類型。");
      void triggerWarningNotification();
      return;
    }

    await triggerLightImpact();
    setIsSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await updateEquipment(equipmentId, {
          name: trimmedName,
          type: typeValue,
          brand: brandValue,
        });
      } else {
        await addEquipment({
          name: trimmedName,
          type: typeValue,
          brand: brandValue,
        });
      }
      await triggerSuccessNotification();
      router.push("/equipment");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "建立器具時發生錯誤。";
      setError(message);
      setIsSaving(false);
      await triggerWarningNotification();
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <FormPageHeader
        title={isEditing ? "編輯沖煮器具" : "新增沖煮器具"}
        description={
          isEditing
            ? "調整器具名稱、類型與品牌資訊，讓後續紀錄維持清楚一致。"
            : "建立一筆獨立器具資料，作為後續沖煮維度擴充的基礎。"
        }
        backLabel="返回器具列表"
      />

      <section className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <form onSubmit={onSubmit} className="grid gap-6">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-text-secondary">器具名稱</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35"
              placeholder="V60 02 濾杯"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-text-secondary">類型</span>
            <select
              required
              value={type}
              onChange={(event) =>
                setType(event.target.value as (typeof equipmentTypes)[number])
              }
              className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35"
            >
              {equipmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-text-secondary">品牌</span>
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/35"
              placeholder="Hario"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-status-error/20 bg-status-error/8 px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          ) : null}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl border border-cta-primary bg-cta-primary px-5 py-3 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "儲存中..." : isEditing ? "儲存變更" : "建立器具"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function NewEquipmentPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
          <FormPageHeader
            title="新增沖煮器具"
            description="正在載入器具資料。"
            backLabel="返回器具列表"
          />
          <section className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
            <p className="text-sm leading-6 text-text-secondary">載入中...</p>
          </section>
        </main>
      }
    >
      <NewEquipmentPageContent />
    </Suspense>
  );
}
