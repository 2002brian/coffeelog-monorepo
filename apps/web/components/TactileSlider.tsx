"use client";

import { ChangeEvent, useState } from "react";
import { triggerSelectionChange } from "@/lib/haptics";

type TactileSliderProps = {
  name: string;
  label: string;
  descriptor: string;
  value: number;
  onChange: (nextValue: number) => void;
};

function triggerDetentFeedback() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
  }

  void triggerSelectionChange();
}

function clampToStep(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export default function TactileSlider({
  name,
  label,
  descriptor,
  value,
  onChange,
}: TactileSliderProps) {
  const [isPressed, setIsPressed] = useState(false);
  const normalizedValue = clampToStep(value);
  const fillPercent = normalizedValue * 20;
  const lightLayerClip = `inset(0 ${100 - fillPercent}% 0 0 round 0.75rem)`;

  function commitNextValue(nextValue: number) {
    const clampedValue = clampToStep(nextValue);

    if (clampedValue === normalizedValue) {
      return;
    }

    onChange(clampedValue);
    triggerDetentFeedback();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = Number.isFinite(event.target.valueAsNumber)
      ? event.target.valueAsNumber
      : Number(event.target.value);

    commitNextValue(nextValue);
  }

  return (
    <div className="select-none">
      <div
        className={`relative overflow-hidden rounded-xl border border-border-subtle bg-dark-control transition-all duration-200 ease-out focus-within:ring-2 focus-within:ring-cta-primary/25 ${
          isPressed ? "scale-[0.98]" : ""
        }`}
      >
        <input
          type="range"
          name={name}
          min="1"
          max="5"
          step="1"
          value={normalizedValue}
          onChange={handleChange}
          onPointerDown={() => setIsPressed(true)}
          onPointerUp={() => setIsPressed(false)}
          onPointerCancel={() => setIsPressed(false)}
          onBlur={() => setIsPressed(false)}
          aria-label={`${label} 評分`}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={normalizedValue}
          aria-valuetext={`${descriptor} ${normalizedValue} / 5`}
          className="absolute inset-0 z-30 h-full w-full cursor-pointer opacity-0"
        />

        <div className="absolute inset-0 bg-dark-control transition-colors duration-200" />
        <div
          className="absolute inset-y-0 left-0 rounded-[0.7rem] transition-all duration-300 ease-out"
          style={{
            width: `${fillPercent}%`,
            background:
              "linear-gradient(90deg,color-mix(in srgb, var(--cta-primary) 74%, white 14%),var(--cta-primary),color-mix(in srgb, var(--cta-primary) 84%, black 12%))",
            boxShadow: "0 8px 18px color-mix(in srgb, var(--cta-primary) 24%, transparent)",
          }}
        />

        <div className="pointer-events-none relative z-10 flex h-14 items-center justify-between gap-4 px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-text-secondary transition-colors duration-200">
              {label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-text-secondary transition-colors duration-200">
              {descriptor}
            </p>
            <p className="mt-1 tabular-nums text-lg font-bold leading-none text-text-primary transition-colors duration-200">
              {normalizedValue}
              <span className="ml-1 text-xs font-semibold text-text-secondary">
                /5
              </span>
            </p>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-20 transition-all duration-300 ease-out"
          style={{ clipPath: lightLayerClip, WebkitClipPath: lightLayerClip }}
        >
          <div className="flex h-14 items-center justify-between gap-4 px-4 text-primary-foreground transition-colors duration-200">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-primary-foreground/90 transition-colors duration-200">
                {label}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-primary-foreground/90 transition-colors duration-200">
                {descriptor}
              </p>
              <p className="mt-1 tabular-nums text-lg font-bold leading-none text-primary-foreground transition-colors duration-200">
                {normalizedValue}
                <span className="ml-1 text-xs font-semibold text-primary-foreground/75 transition-colors duration-200">
                  /5
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
