"use client";

import * as Sentry from "@/lib/sentry";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  AppWindow,
  ChevronRight,
  Download,
  LifeBuoy,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  clearDatabase,
  exportDatabase,
  getBackupSummary,
  importDatabase,
  parseBackupPayload,
  type BackupPayload,
} from "@/lib/backup";
import {
  triggerLightImpact,
  triggerSuccessNotification,
  triggerWarningNotification,
} from "@/lib/haptics";

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="mb-2 pl-2">
        <p className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-dark-panel shadow-sm transition-colors duration-200">
        <div className="divide-y divide-border-subtle">{children}</div>
      </div>
    </section>
  );
}

function SettingActionRow({
  icon: Icon,
  title,
  description,
  onClick,
  href,
  disabled,
  tone = "default",
  trailingLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "danger";
  trailingLabel?: string;
}) {
  const content = (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          tone === "danger"
            ? "bg-status-error/10 text-status-error"
            : "border border-border-subtle bg-dark-control text-text-secondary"
        }`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p
          className={`text-sm font-semibold ${
            tone === "danger" ? "text-status-error" : "text-text-primary"
          }`}
        >
          {title}
        </p>
        <p
          className={`mt-0.5 text-xs leading-5 ${
            tone === "danger" ? "text-status-error/80" : "text-text-secondary"
          }`}
        >
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-text-secondary">
        {trailingLabel ? <span className="text-xs font-medium">{trailingLabel}</span> : null}
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );

  if (href) {
    const isExternal = /^https?:\/\//.test(href);
    const linkProps = isExternal
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};

    return (
      <Link
        href={href}
        {...linkProps}
        className="block w-full px-4 py-3 transition-colors duration-200 hover:bg-dark-control"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full px-4 py-3 text-left transition-colors duration-200 hover:bg-dark-control disabled:cursor-not-allowed disabled:opacity-60"
    >
      {content}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasTriggeredUnlockHapticRef = useRef(false);
  const isDevelopment = process.env.NODE_ENV === "development";

  function formatExportedAt(value?: string) {
    if (!value) {
      return "未提供";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "時間格式不明";
    }

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  async function handleExportBackup() {
    await triggerLightImpact();
    setIsExporting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const result = await exportDatabase();

      setStatusMessage(
        result.mode === "native"
          ? `備份檔 ${result.filename} 已準備完成，請從分享面板選擇儲存位置。`
          : `備份檔 ${result.filename} 已開始下載。`
      );
      await triggerSuccessNotification();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "匯出備份時發生錯誤。"
      );
      await triggerWarningNotification();
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    const isUnlocked = deleteConfirmText === "DELETE";

    if (isUnlocked && !hasTriggeredUnlockHapticRef.current) {
      hasTriggeredUnlockHapticRef.current = true;
      void triggerLightImpact();
      return;
    }

    if (!isUnlocked) {
      hasTriggeredUnlockHapticRef.current = false;
    }
  }, [deleteConfirmText]);

  async function handlePickBackupFile() {
    await triggerLightImpact();
    setStatusMessage(null);
    setErrorMessage(null);
    setPendingImport(null);
    fileInputRef.current?.click();
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsImporting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const json = await file.text();
      const payload = await parseBackupPayload(json);
      setPendingImport(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "匯入備份時發生錯誤。"
      );
      await triggerWarningNotification();
    } finally {
      setIsImporting(false);
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport) {
      return;
    }

    await triggerLightImpact();
    setIsImporting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const result = await importDatabase(pendingImport);

      setPendingImport(null);
      setStatusMessage(
        `資料已成功還原，共合併 ${result.beans} 筆豆單、${result.equipment} 筆器具與 ${result.records} 筆沖煮紀錄。`
      );
      await triggerSuccessNotification();
      window.setTimeout(() => {
        router.push("/records?restored=true");
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "匯入備份時發生錯誤。"
      );
      await triggerWarningNotification();
    } finally {
      setIsImporting(false);
    }
  }

  function handleCancelImport() {
    setPendingImport(null);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function handleClearDatabase() {
    if (deleteConfirmText !== "DELETE") {
      setErrorMessage("請先輸入 DELETE，才可開放清除權限。");
      await triggerWarningNotification();
      return;
    }

    await triggerLightImpact();
    setIsDeleteModalOpen(true);
  }

  function handleCancelDelete() {
    setIsDeleteModalOpen(false);
  }

  async function handleConfirmDelete() {
    setIsDeleteModalOpen(false);
    setIsClearing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await clearDatabase();
      setPendingImport(null);
      setDeleteConfirmText("");
      setStatusMessage("所有本地資料已清空。你可以隨時從備份檔重新還原。");
      await triggerWarningNotification();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "清空本機資料時發生錯誤。"
      );
      await triggerWarningNotification();
    } finally {
      setIsClearing(false);
    }
  }

  async function handleTriggerSentryTest() {
    await triggerLightImpact();

    const error = new Error("Sentry Test Error from Frontend");

    Sentry.captureException(error, {
      tags: {
        feature: "settings",
        trigger: "manual_sentry_test",
      },
        level: "error",
    });

    window.setTimeout(() => {
      throw error;
    }, 0);
  }

  const pendingSummary = pendingImport ? getBackupSummary(pendingImport) : null;
  const isDeleteUnlocked = deleteConfirmText === "DELETE";

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">設定</h1>
        <p className="text-sm leading-6 text-text-secondary">
          管理備份、還原、隱私與支援設定。
        </p>
      </header>

      <SettingsGroup
        title="資料管理"
        description="備份、還原與整理本機上的豆單、器具與沖煮紀錄。"
      >
        <SettingActionRow
          icon={Download}
          title={isExporting ? "正在準備備份資料" : "匯出備份資料"}
          description="將本機資料打包為 JSON，方便保存、分享或轉移到其他裝置。"
          onClick={handleExportBackup}
          disabled={isExporting || isImporting || isClearing}
          trailingLabel="JSON"
        />
        <SettingActionRow
          icon={RotateCcw}
          title={isImporting ? "正在匯入備份資料" : "匯入備份資料"}
          description="從備份檔將豆單、器具與沖煮紀錄安全合併回目前裝置。"
          onClick={handlePickBackupFile}
          disabled={isExporting || isImporting || isClearing}
        />
      </SettingsGroup>

      <section className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-3 text-sm leading-6 text-text-secondary shadow-sm transition-colors duration-200">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-cta-primary" />
          <p>備份只包含目前儲存在本機的資料，不會自動同步到任何雲端服務。</p>
        </div>
      </section>

      {pendingSummary && pendingImport ? (
        <section className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 text-sm leading-6 text-text-primary shadow-sm transition-colors duration-200">
          <p className="font-semibold text-text-primary">匯入預覽</p>
          <p className="mt-2 text-text-secondary">
            這份備份建立於 {formatExportedAt(pendingImport.exportedAt)}
            ，裡面溫存了你的 {pendingSummary.beans} 筆豆單、
            {pendingSummary.equipment} 筆器具與 {pendingSummary.records} 筆沖煮紀錄。
          </p>
          <div className="mt-3 rounded-xl border border-border-subtle bg-dark-control px-3 py-3 text-xs leading-5 text-text-secondary transition-colors duration-200">
            確認匯入後，系統會把這些內容安全合併回目前裝置上的本機資料。
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isImporting || isExporting || isClearing}
              className="inline-flex items-center justify-center rounded-xl border border-cta-primary bg-cta-primary px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting ? "正在匯入" : "確認匯入"}
            </button>
            <button
              type="button"
              onClick={handleCancelImport}
              disabled={isImporting}
              className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-dark-control px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors duration-200 hover:bg-dark-page active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </section>
      ) : null}

      {statusMessage ? (
        <div className="rounded-2xl border border-status-success/20 bg-status-success/10 px-4 py-3 text-sm leading-6 text-status-success transition-colors duration-200">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-status-error/20 bg-status-error/10 px-4 py-3 text-sm leading-6 text-status-error transition-colors duration-200">
          {errorMessage}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportBackup}
      />

      <SettingsGroup
        title="介面預覽"
        description="在 App 內檢查 widget preview/debug 基準，方便對照原生小工具。"
      >
        <SettingActionRow
          icon={AppWindow}
          title="Widget Preview / Debug"
          description="查看 Small / Medium widget 的資料狀態與版型基準。"
          href="/settings/widgets"
        />
      </SettingsGroup>

      <SettingsGroup
        title="隱私與支援"
        description="檢視隱私權說明，或在遇到資料與 AI 相關問題時取得協助。"
      >
        <SettingActionRow
          icon={MessageSquare}
          title="回饋問題與建議"
          description="有任何使用回饋、功能想法或遇到的小問題，都歡迎透過表單告訴我們。"
          href="https://docs.google.com/forms/d/e/1FAIpQLSdC_kRc5AmbiDW0MAwywt8hEvRQqsr59CYbFjkjm7yFGIvdvA/viewform?usp=publish-editor"
          trailingLabel="表單"
        />
        <SettingActionRow
          icon={ShieldCheck}
          title="隱私權政策"
          description="了解 CoffeeLog 如何處理本地資料、備份與 AI 對話的傳輸方式。"
          href="/privacy"
        />
        <SettingActionRow
          icon={LifeBuoy}
          title="支援中心"
          description="如果匯入、還原或 AI 教練出現問題，可從這裡取得聯絡方式。"
          href="/support"
        />
      </SettingsGroup>

      <SettingsGroup
        title="危險操作"
        description="刪除前仍需二次確認，避免誤觸造成不可逆清空。"
      >
        <div className="px-4 py-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-status-error">輸入英文字 DELETE 以解鎖刪除</span>
            <input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="輸入 DELETE"
              className="rounded-xl border border-border-subtle bg-dark-control px-3 py-2.5 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error/30"
            />
          </label>
          {isDeleteUnlocked ? (
            <p className="mt-2 text-xs font-medium text-status-success">權限已開放</p>
          ) : null}
        </div>

        <SettingActionRow
          icon={Trash2}
          title={isClearing ? "正在清空資料" : "清空所有本機資料"}
          description="移除目前裝置上的所有豆單、器具與沖煮紀錄。"
          onClick={handleClearDatabase}
          disabled={isClearing || isImporting || isExporting || !isDeleteUnlocked}
          tone="danger"
        />
      </SettingsGroup>

      {isDevelopment ? (
        <SettingsGroup
          title="開發模式"
          description="用來驗證前端錯誤遙測是否已成功送進 Sentry。"
        >
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={handleTriggerSentryTest}
              className="inline-flex items-center justify-center rounded-xl border border-status-error/20 bg-dark-control px-4 py-2.5 text-sm font-semibold text-status-error transition-colors duration-200 hover:bg-dark-page active:scale-95"
            >
              [Dev Only] 觸發 Sentry 測試錯誤
            </button>
          </div>
        </SettingsGroup>
      ) : null}

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-coffee-accent/20 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-dark-panel p-6 shadow-sm transition-colors duration-200">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-status-error/20 bg-dark-control text-status-error">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-text-primary">
                  確定要清空所有資料嗎？
                </h2>
                <p className="text-sm leading-6 text-text-secondary">
                  這會移除目前裝置上的所有豆單、器具與沖煮紀錄。建議先完成匯出備份，再執行這個不可逆操作。
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-dark-control px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors duration-200 hover:bg-dark-page active:scale-95"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="inline-flex items-center justify-center rounded-xl border border-status-error bg-status-error px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-95"
              >
                確認清空
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
