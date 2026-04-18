import { Suspense } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import BrewFormClient from "./BrewFormClient";

function BrewFormShell() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-transparent px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <FormPageHeader
        title="新增沖煮紀錄"
        description="快速記錄本次沖煮條件與感官表現。"
      />

      <BrewFormClient />
    </main>
  );
}

export default function NewBrewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl space-y-6 bg-transparent px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
          <FormPageHeader
            title="新增沖煮紀錄"
            description="快速記錄本次沖煮條件與感官表現。"
          />
          <section className="glass-panel ui-rhythm rounded-xl px-4 py-4">
            <p className="text-sm leading-6 text-text-secondary">
              載入中...
            </p>
          </section>
        </main>
      }
    >
      <BrewFormShell />
    </Suspense>
  );
}
