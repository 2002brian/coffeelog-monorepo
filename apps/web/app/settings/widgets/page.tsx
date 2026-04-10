"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import {
  WIDGET_PREVIEW_STATES,
  buildWidgetPreviewPayload,
  useWidgetPayload,
} from "@/lib/widgetData";

function PreviewSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
        <p className="text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function WidgetGalleryPage() {
  const payload = useWidgetPayload();
  const currentPayload = payload ?? buildWidgetPreviewPayload("normal");

  return (
    <main className="mx-auto max-w-6xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <header className="space-y-2">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          返回設定
        </Link>
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
            Widget Preview / Debug
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-text-secondary">
            這裡是 App 內的 widget preview/debug 面板。上方顯示目前資料庫的真實狀態，下方則列出各種狀態的固定參考視圖，方便對照原生 Widget Extension 的實作結果。
          </p>
        </div>
      </header>

      <PreviewSection
        title="目前資料庫狀態"
        description={
          payload
            ? `目前偵測到的 Widget 狀態為 ${payload.status}，以下卡片直接反映現有本機資料。`
            : "正在讀取本機資料。載入完成後，這兩張卡片會切換成真實 Widget payload。"
        }
      >
        <div className="rounded-2xl border border-border-subtle bg-dark-panel p-4 shadow-sm transition-colors duration-200 sm:p-5">
          <div className="flex flex-col items-center gap-6 sm:items-start">
            <WidgetCard payload={currentPayload} size="small" />
            <WidgetCard payload={currentPayload} size="medium" />
          </div>
        </div>
      </PreviewSection>

      <PreviewSection
        title="狀態參考"
        description="每一列都固定對應一種資料狀態，這些卡片只作為 App 內預覽與除錯基準，不會假裝成系統 widget 本體。"
      >
        <div className="space-y-4">
          {WIDGET_PREVIEW_STATES.map((status) => {
            const previewPayload = buildWidgetPreviewPayload(status, payload);

            return (
              <section
                key={status}
                className="rounded-2xl border border-border-subtle bg-dark-panel p-4 shadow-sm transition-colors duration-200 sm:p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{status}</p>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      Small 與 Medium 會共用同一份 preview payload，便於比對版型在不同尺寸下的反應。
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-6 sm:items-start">
                  <WidgetCard payload={previewPayload} size="small" />
                  <WidgetCard payload={previewPayload} size="medium" />
                </div>
              </section>
            );
          })}
        </div>
      </PreviewSection>
    </main>
  );
}
