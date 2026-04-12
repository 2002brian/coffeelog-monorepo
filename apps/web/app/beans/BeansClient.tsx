"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useBrewData } from "@/hooks/useBrewData";
import {
  triggerLightImpact,
  triggerSuccessNotification,
  triggerWarningNotification,
} from "@/lib/haptics";
import { schedulePeakNotification } from "@/lib/notifications";

const PeakPredictionResponseSchema = z.object({
  recommendedRestDays: z.number().int().nonnegative(),
  reason: z.string().trim().min(1),
});

function toIsoDate(dateInput: string, hour: number) {
  const [year, month, day] = dateInput.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function calculatePeakDate(roastDate: string, recommendedRestDays: number) {
  const [year, month, day] = roastDate.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(
    year,
    month - 1,
    day + recommendedRestDays,
    9,
    0,
    0,
    0
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatPeakDate(peakDate: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
  }).format(new Date(peakDate));
}

function normalizePredictionReason(reason: string) {
  return reason.replace(/\s+/g, " ").trim();
}

function resolvePeakPredictionEndpoint() {
  const explicitEndpoint =
    process.env.NEXT_PUBLIC_BEAN_PREDICT_ENDPOINT?.trim() ?? "";

  if (explicitEndpoint) {
    return explicitEndpoint;
  }

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL?.trim() || "http://127.0.0.1:3001";

  if (apiBaseUrl) {
    return `${apiBaseUrl.replace(/\/$/, "")}/api/beans/predict-peak`;
  }

  const chatEndpoint = process.env.NEXT_PUBLIC_AI_CHAT_ENDPOINT?.trim() ?? "";

  if (chatEndpoint.endsWith("/api/chat")) {
    return `${chatEndpoint.slice(0, -"/api/chat".length)}/api/beans/predict-peak`;
  }

  return "/api/beans/predict-peak";
}

export default function BeansClient() {
  const { addBean } = useBrewData();
  const [origin, setOrigin] = useState("");
  const [roastLevel, setRoastLevel] = useState("");
  const [process, setProcess] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [peakDate, setPeakDate] = useState("");
  const [prediction, setPrediction] = useState<z.infer<
    typeof PeakPredictionResponseSchema
  > | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peakPredictionEndpoint = useMemo(resolvePeakPredictionEndpoint, []);
  const canPredict =
    origin.trim().length > 0 &&
    roastLevel.trim().length > 0 &&
    process.trim().length > 0;
  const predictionReason = prediction
    ? normalizePredictionReason(prediction.reason)
    : "";

  useEffect(() => {
    if (!prediction || !roastDate) {
      setPeakDate("");
      return;
    }

    const nextPeakDate = calculatePeakDate(
      roastDate,
      prediction.recommendedRestDays
    );
    setPeakDate(nextPeakDate ?? "");
  }, [prediction, roastDate]);

  function resetPrediction() {
    setPrediction(null);
    setPeakDate("");
  }

  async function onPredictPeak() {
    if (!canPredict) {
      return;
    }

    if (!roastDate) {
      setError("請先填寫烘豆日期，才能推算最佳賞味日。");
      await triggerWarningNotification();
      return;
    }

    await triggerLightImpact();
    setIsPredicting(true);
    setError(null);

    try {
      console.log("Peak Prediction Endpoint:", peakPredictionEndpoint);
      const response = await fetch(peakPredictionEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin,
          process,
          roastLevel,
        }),
      });
      console.log("Response Status:", response.status);
      const payload = (await response.json().catch(() => null)) as unknown;
      console.log("Received Data:", payload);

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "API 沒回應";
        throw new Error(message);
      }

      if (payload === null) {
        throw new Error("AI 預測 API 回傳空資料。");
      }

      const parsed = PeakPredictionResponseSchema.parse(payload);
      const calculatedPeakDate = calculatePeakDate(
        roastDate,
        parsed.recommendedRestDays
      );

      if (!calculatedPeakDate) {
        throw new Error("無法根據烘豆日期計算最佳賞味日。");
      }

      setPrediction(parsed);
      setPeakDate(calculatedPeakDate);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI 養豆預測失敗。";
      console.error("Peak prediction failed:", err);
      setError(message);
      await triggerWarningNotification();
    } finally {
      setIsPredicting(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const notes = notesRaw.length > 0 ? notesRaw : null;
    const totalWeightValue = Number(totalWeight);
    const roastDateIso = toIsoDate(roastDate, 12);
    const status = String(formData.get("status") ?? "RESTING").trim();

    if (!name || !origin || !roastLevel || !process) {
      setError("請完整填寫名稱、產區、烘焙度與處理法。");
      await triggerWarningNotification();
      return;
    }

    if (!Number.isFinite(totalWeightValue) || totalWeightValue <= 0) {
      setError("請填入有效的總重量。");
      await triggerWarningNotification();
      return;
    }

    if (!roastDateIso) {
      setError("請填入有效的烘豆日期。");
      await triggerWarningNotification();
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
        totalWeight: totalWeightValue,
        remainingWeight: totalWeightValue,
        status:
          status === "ACTIVE" || status === "ARCHIVED" ? status : "RESTING",
        roastDate: roastDateIso,
        peakDate: peakDate || undefined,
      });

      if (peakDate) {
        await schedulePeakNotification(name, peakDate);
      }

      await triggerSuccessNotification();
      form.reset();
      setOrigin("");
      setRoastLevel("");
      setProcess("");
      setTotalWeight("");
      setRoastDate("");
      resetPrediction();
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
        <input type="hidden" name="status" value="RESTING" />

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
            value={origin}
            onChange={(event) => {
              setOrigin(event.target.value);
              resetPrediction();
            }}
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Ethiopia"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">烘焙度</span>
          <input
            name="roastLevel"
            required
            value={roastLevel}
            onChange={(event) => {
              setRoastLevel(event.target.value);
              resetPrediction();
            }}
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Light / Medium / Dark"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">處理法</span>
          <input
            name="process"
            required
            value={process}
            onChange={(event) => {
              setProcess(event.target.value);
              resetPrediction();
            }}
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="Washed / Natural / Honey"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">總重量 (g)</span>
          <input
            name="totalWeight"
            type="number"
            min="0"
            step="0.1"
            required
            value={totalWeight}
            onChange={(event) => setTotalWeight(event.target.value)}
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
            placeholder="250"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-text-secondary">烘豆日期</span>
          <input
            name="roastDate"
            type="date"
            required
            value={roastDate}
            onChange={(event) => setRoastDate(event.target.value)}
            className="rounded-xl border border-border-subtle bg-dark-control px-4 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/35"
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

        {canPredict ? (
          <div className="sm:col-span-2 rounded-2xl border border-border-subtle bg-dark-control px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-text-primary">
                  AI 養豆預測
                </p>
                <p className="text-xs leading-5 text-text-secondary">
                  根據產區、處理法與烘焙度推算建議養豆天數，並自動計算最佳賞味日。
                </p>
              </div>
              <button
                type="button"
                onClick={onPredictPeak}
                disabled={isPredicting || !roastDate}
                className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-dark-panel px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors duration-200 hover:bg-dark-panel/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPredicting ? "預測中..." : "取得 AI 建議"}
              </button>
            </div>

            {prediction ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-4">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-200/80">
                      AI 建議
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <p className="text-3xl font-semibold leading-none text-text-primary">
                        {prediction.recommendedRestDays}
                      </p>
                      <p className="pb-1 text-sm font-medium text-text-secondary">
                        天養豆
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-primary">
                      {predictionReason}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-dark-panel px-4 py-4">
                    <p className="text-xs font-medium text-text-secondary">
                      最佳賞味日
                    </p>
                    <p className="mt-2 text-lg font-semibold text-text-primary">
                      {peakDate ? formatPeakDate(peakDate) : "尚未計算"}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-text-secondary">
                      若儲存在原生 App，送出後會於當天上午 9:00 排程提醒。
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-border-subtle bg-dark-panel px-3 py-1.5 text-xs font-medium text-text-secondary">
                    產區 {origin.trim()}
                  </span>
                  <span className="inline-flex rounded-full border border-border-subtle bg-dark-panel px-3 py-1.5 text-xs font-medium text-text-secondary">
                    處理法 {process.trim()}
                  </span>
                  <span className="inline-flex rounded-full border border-border-subtle bg-dark-panel px-3 py-1.5 text-xs font-medium text-text-secondary">
                    烘焙度 {roastLevel.trim()}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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
