"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { mounted, setTheme, theme } = useTheme();

  return (
    <div className="inline-flex items-center rounded-2xl border border-border-subtle bg-dark-panel p-1 shadow-sm shadow-black/10">
      <button
        type="button"
        aria-label="切換為明亮模式"
        onClick={() => setTheme("light")}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
          mounted && theme === "light"
            ? "bg-dark-control text-text-primary"
            : "text-text-secondary"
        }`}
      >
        <SunMedium className="h-4.5 w-4.5" />
      </button>
      <button
        type="button"
        aria-label="切換為深色模式"
        onClick={() => setTheme("dark")}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
          mounted && theme === "dark"
            ? "bg-dark-control text-text-primary"
            : "text-text-secondary"
        }`}
      >
        <MoonStar className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}
