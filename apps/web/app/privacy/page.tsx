import FormPageHeader from "@/components/FormPageHeader";

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="mb-2 pl-2 text-[13px] font-medium uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-4">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-text-secondary">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-dark-page px-4 pb-6 pt-2 transition-colors duration-200 sm:px-6">
      <FormPageHeader
        title="隱私權政策"
        description="資料預設留在你的裝置中，只有主動使用 AI 功能時才會傳送必要上下文。"
        backLabel="返回設定"
      />

      <section className="space-y-2">
        <SectionEyebrow>政策內容</SectionEyebrow>
        <article className="overflow-hidden rounded-2xl border border-border-subtle bg-dark-panel shadow-sm transition-colors duration-200">
          <div className="divide-y divide-border-subtle">
            <PolicySection title="本地儲存優先">
              <p>
                CoffeeLog 採用本地儲存優先架構。你的咖啡豆、器具與沖煮紀錄，預設都儲存在目前裝置上的
                IndexedDB 中，不會自動同步到中央資料庫。
              </p>
              <p>
                開發者不會主動收集這些內容，也不會在背景中建立可識別個人的使用者資料檔案。
              </p>
            </PolicySection>

            <PolicySection title="AI 功能與資料傳輸">
              <p>
                當你主動使用 AI 教練時，當次對話內容與必要的沖煮參數，例如粉量、水量、水溫、總時間與感官評分，
                會經過加密傳輸送往外部 AI 服務供應商，以生成對應建議。
              </p>
              <p>
                這些資料只用於當次回應生成，不會直接與你的個人身份綁定。
              </p>
            </PolicySection>

            <PolicySection title="資料控制權">
              <p>你可以隨時前往設定頁執行以下操作：</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>匯出本機備份檔，保存或轉移資料</li>
                <li>匯入既有備份，將資料還原到目前裝置</li>
                <li>永久清空本機資料庫中的所有內容</li>
              </ul>
              <p>
                若你選擇清空資料，而又沒有另外保留備份，資料將無法復原。
              </p>
            </PolicySection>

            <PolicySection title="政策更新">
              <p>
                若未來 CoffeeLog 的資料流或 AI 服務架構有重大變更，我們會同步更新這份政策，讓你清楚知道資料如何被使用。
              </p>
            </PolicySection>
          </div>
        </article>
      </section>
    </main>
  );
}
