"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type FormPageHeaderProps = {
  title: string;
  description: string;
  backLabel?: string;
};

export default function FormPageHeader({
  title,
  description,
  backLabel = "返回上一頁",
}: FormPageHeaderProps) {
  const router = useRouter();

  return (
    <header className="space-y-2">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors duration-200 hover:text-text-primary active:scale-[0.98]"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>{backLabel}</span>
      </button>

      <div className="space-y-2">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        <p className="text-sm leading-6 text-text-secondary">
          {description}
        </p>
      </div>
    </header>
  );
}
