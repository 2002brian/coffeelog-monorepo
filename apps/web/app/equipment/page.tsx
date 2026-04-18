"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { getActiveEquipments } from "@/hooks/useBrewData";

const equipmentTypeOrder = ["濾杯", "磨豆機", "濾紙", "手沖壺", "其他"] as const;

const equipmentTypeDescriptions: Record<(typeof equipmentTypeOrder)[number], string> = {
  濾杯: "集中整理不同尺寸與萃取幾何。",
  磨豆機: "比對不同研磨設備的配方差異。",
  濾紙: "管理不同材質與形狀的濾紙設定。",
  手沖壺: "管理注水器具與使用脈絡。",
  其他: "收納未歸類的輔助器具。",
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-TW");
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="mb-2 pl-2 text-[13px] font-medium uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  );
}

export default function EquipmentPage() {
  const equipments = useLiveQuery(() => getActiveEquipments(), []);

  const groupedEquipments = useMemo(() => {
    if (!equipments) {
      return [];
    }

    return equipmentTypeOrder
      .map((type) => ({
        type,
        description: equipmentTypeDescriptions[type],
        items: equipments.filter((equipment) => equipment.type === type),
      }))
      .filter((group) => group.items.length > 0);
  }, [equipments]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 bg-transparent px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
            沖煮器具
          </h1>
          <Link
            href="/equipment/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cta-primary bg-cta-primary px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>新增器具</span>
          </Link>
        </div>
        <p className="text-sm leading-6 text-text-secondary">
          管理濾杯、磨豆機與手沖壺等器具資料。
        </p>
      </header>

      {equipments === undefined ? (
        <section className="glass-panel ui-rhythm rounded-2xl px-4 py-4 text-sm text-text-secondary">
          正在從本地資料庫載入器具資料。
        </section>
      ) : equipments.length === 0 ? (
        <section className="glass-panel ui-rhythm rounded-2xl px-4 py-4 text-sm text-text-secondary">
          尚未建立任何器具。
        </section>
      ) : (
        <div className="space-y-6">
          {groupedEquipments.map((group) => (
            <section key={group.type} className="space-y-2">
              <SectionEyebrow>{group.type}</SectionEyebrow>
              <div className="glass-panel ui-rhythm overflow-hidden rounded-2xl">
                <div className="border-b border-border-subtle px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">
                        {group.type}
                      </h2>
                      <p className="mt-1 text-sm leading-5 text-text-secondary">
                        {group.description}
                      </p>
                    </div>
                    <span className="glass-chip ui-rhythm shrink-0 rounded-full px-2.5 py-1 text-[13px] font-medium text-text-secondary">
                      {group.items.length} 件
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border-subtle">
                  {group.items.map((equipment) => (
                    <Link
                      key={equipment.id}
                      href={`/equipment/new?id=${equipment.id}`}
                      className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 transition-colors duration-200 hover:bg-white/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/30"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-text-primary">
                          {equipment.name}
                        </h3>
                        <p className="mt-1 truncate text-sm leading-5 text-text-secondary">
                          {equipment.brand ?? "未填寫品牌"} · {formatDate(equipment.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="glass-chip ui-rhythm rounded-full px-2.5 py-1 text-[13px] font-medium text-text-secondary">
                          {equipment.brand ?? "未填寫"}
                        </span>
                        <ChevronRight className="h-4 w-4 text-text-secondary" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
