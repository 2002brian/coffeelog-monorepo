"use client";

import { FormEvent, useState } from "react";
import { useBrewData } from "@/hooks/useBrewData";
import {
  triggerLightImpact,
  triggerSuccessNotification,
  triggerWarningNotification,
} from "@/lib/haptics";

export default function BeansClient() {
  const { addBean } = useBrewData();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const origin = String(formData.get("origin") ?? "").trim();
    const roastLevel = String(formData.get("roastLevel") ?? "").trim();
    const process = String(formData.get("process") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const notes = notesRaw.length > 0 ? notesRaw : null;

    if (!name || !origin || !roastLevel || !process) {
      setError("請完整填寫名稱、產區、烘焙度與處理法。");
      void triggerWarningNotification();
      return;
    }

    await triggerLightImpact();
    setIsSaving(true);
    setError(null);

    try {
      await addBean({
        name,
        origin,
        roastLevel,
        process,
        notes,
      });
      await triggerSuccessNotification();
      form.reset();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "新增咖啡豆時發生錯誤。";
      setError(message);
      await triggerWarningNotification();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">名稱</span>
          <input
            name="name"
            required
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Ethiopia Yirgacheffe"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">產區</span>
          <input
            name="origin"
            required
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Ethiopia"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">烘焙度</span>
          <input
            name="roastLevel"
            required
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Light / Medium / Dark"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">處理法</span>
          <input
            name="process"
            required
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Washed / Natural / Honey"
          />
        </label>

        <label className="grid gap-1 sm:col-span-2">
          <span className="text-sm font-medium text-text-secondary">風味描述</span>
          <textarea
            name="notes"
            rows={3}
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Floral, citrus, tea-like body..."
          />
        </label>

        {error ? (
          <div className="sm:col-span-2 rounded-2xl border border-status-error/20 bg-status-error/8 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-xl border border-cta-primary bg-cta-primary px-5 py-3 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "儲存中..." : "新增咖啡豆"}
          </button>
        </div>
      </form>
    </section>
  );
}
