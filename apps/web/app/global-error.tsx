"use client";

import { useEffect } from "react";
import * as Sentry from "@/lib/sentry";
import { AlertTriangle, House, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-TW">
      <body className="bg-bg-base text-text-primary antialiased">
        <main className="app-safe-area flex min-h-screen items-center justify-center overflow-x-hidden px-4 py-6">
          <section className="w-full max-w-md rounded-2xl border border-border-subtle bg-dark-panel px-6 py-6 shadow-sm transition-colors duration-200">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-status-error/20 bg-status-error/10 text-status-error">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
                CoffeeLog
              </p>
              <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
                系統發生異常
              </h1>
              <p className="text-sm leading-6 text-text-secondary">
                我們已記錄這次錯誤。請先重新整理目前畫面；如果仍然失敗，再返回首頁繼續操作。
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cta-primary bg-cta-primary px-5 py-3 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                <span>重新整理</span>
              </button>
              <a
                href="/"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-dark-control px-5 py-3 text-sm font-semibold text-text-primary shadow-sm transition-colors duration-200 hover:bg-dark-page active:scale-95"
              >
                <House className="h-4 w-4" />
                <span>回到首頁</span>
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
