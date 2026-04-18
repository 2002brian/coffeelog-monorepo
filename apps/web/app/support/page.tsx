import FormPageHeader from "@/components/FormPageHeader";

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="mb-2 pl-2 text-[13px] font-medium uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  );
}

function InfoRow({
  title,
  description,
  trailing,
}: {
  title: string;
  description: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-transparent px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <FormPageHeader
        title="支援與關於"
        description="如果你在使用 CoffeeLog 或 AI 教練時遇到問題，可以從這裡取得協助。"
        backLabel="返回設定"
      />

      <section className="space-y-2">
        <SectionEyebrow>聯絡支援</SectionEyebrow>
        <div className="glass-panel ui-rhythm overflow-hidden rounded-2xl">
          <div className="divide-y divide-border-subtle">
            <InfoRow
              title="技術支援"
              description="如果你在使用 CoffeeLog 或 AI 教練時遇到問題，歡迎直接來信。若能附上裝置型號、系統版本與問題發生情境，會更有助於快速排查。"
              trailing={
                <a
                  href="mailto:wdysatoshi0324@gmail.com"
                  className="inline-flex items-center justify-center rounded-xl border border-cta-primary bg-cta-primary px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-sm transition-colors duration-200 hover:brightness-105 active:scale-95"
                >
                  wdysatoshi0324@gmail.com
                </a>
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <SectionEyebrow>服務資訊</SectionEyebrow>
        <div className="glass-panel ui-rhythm overflow-hidden rounded-2xl">
          <div className="divide-y divide-border-subtle">
            <InfoRow
              title="本地資料優先"
              description="CoffeeLog 以本地儲存為核心，豆單、器具與沖煮紀錄預設保留在你的裝置內。"
            />
            <InfoRow
              title="AI 教練"
              description="只有在你主動發起對話時，才會傳送當次回應所需的沖煮上下文。"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
