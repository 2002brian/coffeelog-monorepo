"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Coffee, MapPin, Search, Waves } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import BeansClient from "./BeansClient";
import { getActiveBeans } from "@/hooks/useBrewData";

function extractFlavorTags(notes: string | null | undefined) {
  if (!notes) return [];

  return notes
    .split(/[,/、]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="mb-2 pl-2 text-[13px] font-medium uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  );
}

export default function BeansPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const beans = useLiveQuery(() => getActiveBeans(), []);

  const filteredBeans = useMemo(() => {
    if (!beans) return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return beans;

    return beans.filter((bean) =>
      [bean.name, bean.origin, bean.roastLevel, bean.process, bean.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [beans, searchQuery]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 bg-transparent px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
          咖啡豆
        </h1>
        <p className="text-sm leading-6 text-text-secondary">
          集中管理豆單與風味資訊。
        </p>
      </header>

      <section className="space-y-2">
        <SectionEyebrow>搜尋</SectionEyebrow>
        <label className="glass-panel ui-rhythm flex items-center gap-3 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary-default/35">
          <Search className="h-4.5 w-4.5 text-text-secondary" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/80 focus-visible:outline-none"
            placeholder="搜尋豆名、產區、處理法或風味"
            aria-label="搜尋咖啡豆"
          />
          <span className="shrink-0 text-[13px] font-medium text-text-secondary">
            {beans ? `${filteredBeans.length}` : "--"}
          </span>
        </label>
      </section>

      <section className="space-y-2">
        <SectionEyebrow>豆單列表</SectionEyebrow>

        {beans === undefined ? (
          <div className="glass-panel ui-rhythm rounded-2xl px-4 py-4 text-sm text-text-secondary">
            正在從本地資料庫載入豆單...
          </div>
        ) : beans.length === 0 ? (
          <div className="glass-panel ui-rhythm rounded-2xl px-4 py-4 text-sm text-text-secondary">
            目前尚無咖啡豆資料，先新增第一支豆子吧。
          </div>
        ) : filteredBeans.length === 0 ? (
          <div className="glass-panel ui-rhythm rounded-2xl px-4 py-4 text-sm text-text-secondary">
            沒有符合搜尋條件的豆子。
          </div>
        ) : (
          <div className="space-y-3">
              {filteredBeans.map((bean) => {
                const flavorTags = extractFlavorTags(bean.notes);

                return (
                  <article
                    key={bean.id}
                    className="glass-panel ui-rhythm rounded-2xl px-4 py-3 hover:bg-white/4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-4 w-4 text-text-secondary" />
                          <h2 className="truncate text-sm font-semibold text-text-primary">
                            {bean.name}
                          </h2>
                        </div>
                        <p className="mt-1 truncate text-sm leading-5 text-text-secondary">
                          {bean.roastLevel} · {bean.origin} · {bean.process}
                        </p>
                      </div>
                      <span className="glass-chip ui-rhythm shrink-0 rounded-full px-2.5 py-1 text-[13px] font-medium text-text-secondary">
                        {flavorTags.length > 0 ? `${flavorTags.length} 標籤` : "未標記"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {flavorTags.length > 0 ? (
                        flavorTags.map((tag) => (
                          <span
                            key={tag}
                            className="glass-chip ui-rhythm inline-flex rounded-full px-2.5 py-1 text-[13px] font-medium text-text-secondary"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="glass-chip ui-rhythm inline-flex rounded-full px-2.5 py-1 text-[13px] font-medium text-text-secondary">
                          尚未設定風味標籤
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="glass-chip ui-rhythm rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2 text-text-secondary">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="text-[13px] font-medium text-text-secondary">產區</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-text-primary">
                          {bean.origin}
                        </p>
                      </div>
                      <div className="glass-chip ui-rhythm rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2 text-text-secondary">
                          <Waves className="h-3.5 w-3.5" />
                          <span className="text-[13px] font-medium text-text-secondary">處理法</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-text-primary">
                          {bean.process}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Link
                        href={`/brew/new?beanId=${bean.id}`}
                        className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-cta-primary bg-cta-primary px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-[0.98]"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Coffee className="h-4 w-4" />
                          開始沖煮
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionEyebrow>新增豆子</SectionEyebrow>
        <BeansClient />
      </section>
    </main>
  );
}
