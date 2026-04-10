# CoffeeLog 專案架構與功能總覽

## 1. 專案定位

CoffeeLog 是一個以 **Next.js App Router** 建構的本機優先咖啡沖煮記錄應用，核心目標是讓使用者在手機介面中完成：

- 咖啡豆管理
- 器具管理
- 沖煮紀錄輸入
- 歷史查詢與分析
- 本地資料備份與還原
- AI 對話式建議

目前系統同時支援：

- 深色主題
- 明亮主題
- 手機安全區（safe area）
- iOS 風格導向的介面收斂

---

## 2. 技術架構

### 前端框架

- **Next.js 16**
- **React**
- **App Router**
- 頁面多為 client component，因為大量依賴本地資料庫與互動狀態

### 本地資料層

- **Dexie.js** 作為 IndexedDB 封裝
- 主要資料表定義於 [lib/db.ts](/Users/brianwu/Documents/codex/coffeelog/lib/db.ts)
- 目前採用 **local-first** 架構，前端直接從本地資料庫查詢與更新資料

### UI / Styling

- **Tailwind CSS**
- 全域主題 token 定義於 [app/globals.css](/Users/brianwu/Documents/codex/coffeelog/app/globals.css)
- Tailwind 顏色延伸定義於 [tailwind.config.ts](/Users/brianwu/Documents/codex/coffeelog/tailwind.config.ts)
- 主題切換由 [components/ThemeProvider.tsx](/Users/brianwu/Documents/codex/coffeelog/components/ThemeProvider.tsx) 與 [components/ThemeToggle.tsx](/Users/brianwu/Documents/codex/coffeelog/components/ThemeToggle.tsx) 管理

### 導航與外框

- 全域外框由 [app/layout.tsx](/Users/brianwu/Documents/codex/coffeelog/app/layout.tsx) 提供
- 底部導覽列由 [components/BottomNav.tsx](/Users/brianwu/Documents/codex/coffeelog/components/BottomNav.tsx) 提供
- PWA manifest 定義於 [app/manifest.ts](/Users/brianwu/Documents/codex/coffeelog/app/manifest.ts)

---

## 3. 資料模型

### CoffeeBean

定義於 [lib/db.ts](/Users/brianwu/Documents/codex/coffeelog/lib/db.ts)

- `id`
- `name`
- `origin`
- `roastLevel`
- `process`
- `notes`
- `createdAt`
- `updatedAt`

### Equipment

- `id`
- `name`
- `type`
- `brand`
- `createdAt`
- `updatedAt`

### BrewRecord

- `id`
- `beanId`
- `equipmentId`
- `dose`
- `water`
- `temperature`
- `brewTime`
- `grindSize`
- `bloomTime`
- `acidity`
- `sweetness`
- `body`
- `bitterness`
- `feedback`
- `createdAt`
- `updatedAt`

### LocalBrewContext

用於詳情頁的聚合資料結構：

- `record`
- `bean`
- `equipment`

---

## 4. 本地資料庫設計

資料庫類別為 `CoffeeLogDB`，位於 [lib/db.ts](/Users/brianwu/Documents/codex/coffeelog/lib/db.ts)。

### 版本演進

- `version(1)`
  - 舊版 schema
  - 使用數字 id 與舊欄位結構

- `version(2)`
  - 導入 UUID 主鍵
  - 拆分為：
    - `beansV2`
    - `equipmentsV2`
    - `brewRecordsV2`
  - 內建 migration，會把舊版資料轉成 V2 格式

### 目前索引方向

- `beansV2: id, createdAt, updatedAt, name, origin`
- `equipmentsV2: id, createdAt, updatedAt, type, name`
- `brewRecordsV2: id, createdAt, updatedAt, beanId, equipmentId`

---

## 5. 主要功能模組

### 5.1 首頁 Dashboard

檔案：

- [app/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/page.tsx)

目前功能：

- 顯示本週摘要
  - 本週杯數
  - 平均分
  - 高分杯數
- 顯示 AI 提醒摘要
- 顯示決策模組
  - 新增沖煮
  - 本週最佳配方
  - 近期需調整
- 顯示快捷入口
  - 豆單
  - 器具
  - 沖煮
  - AI Coach
- 開啟分析面板
  - 本週
  - 本月
  - 自訂區間

### 5.2 終極分析面板

主要邏輯：

- [app/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/page.tsx)
- [lib/data.ts](/Users/brianwu/Documents/codex/coffeelog/lib/data.ts)

目前功能：

- 時間區間切換
  - 本週
  - 本月
  - 自訂區間
- 真實趨勢圖（SVG）
  - 每日平均得分
- 洞察分頁
  - 低分分析
  - 最佳配方
  - 器具比較
- 最佳配方可「一鍵帶入新沖煮」

### 5.3 咖啡豆管理

檔案：

- [app/beans/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/beans/page.tsx)
- [app/beans/BeansClient.tsx](/Users/brianwu/Documents/codex/coffeelog/app/beans/BeansClient.tsx)

功能：

- 顯示咖啡豆列表
- 新增咖啡豆
- 管理豆單資訊

### 5.4 器具管理

檔案：

- [app/equipment/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/equipment/page.tsx)
- [app/equipment/new/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/equipment/new/page.tsx)

功能：

- 顯示器具列表
- 依器具類型分組顯示
- 新增器具

### 5.5 新增沖煮表單

檔案：

- [app/brew/new/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/brew/new/page.tsx)
- [app/brew/new/BrewFormClient.tsx](/Users/brianwu/Documents/codex/coffeelog/app/brew/new/BrewFormClient.tsx)

功能：

- 選擇咖啡豆
- 選擇器具
- 輸入沖煮參數
  - 粉量
  - 水量
  - 水溫
  - 研磨度
  - 沖煮時間
  - 悶蒸時間
- 感官評分
  - 酸度
  - 甜度
  - 醇厚感
  - 苦味
- 文字筆記
- 快速預設配方
- 從最佳配方一鍵帶入預填參數

### 5.6 觸覺滑桿

檔案：

- [components/TactileSlider.tsx](/Users/brianwu/Documents/codex/coffeelog/components/TactileSlider.tsx)

功能：

- 客製化感官滑桿
- 視覺填充動畫
- 震動回饋
- 與表單 state 綁定

### 5.7 歷史紀錄列表

檔案：

- [app/records/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/records/page.tsx)

功能：

- 顯示高密度歷史紀錄清單
- 排序
- 篩選
- 進入單筆詳情頁

### 5.8 歷史詳情頁

檔案：

- [app/records/detail/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/records/detail/page.tsx)

功能：

- 顯示單筆沖煮的摘要資訊
- 感官評分
- 風味標籤
- 筆記
- 參數回顧

### 5.9 設定頁

檔案：

- [app/settings/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/settings/page.tsx)

功能：

- 匯出本地資料
- 匯入備份資料
- 清空本地資料
- 危險操作確認流程

### 5.10 備份與還原

檔案：

- [lib/backup.ts](/Users/brianwu/Documents/codex/coffeelog/lib/backup.ts)

功能：

- 匯出 beans / equipments / brew records
- 匯入備份
- 清除所有本地資料

### 5.11 AI Coach

檔案：

- [components/AICoach.tsx](/Users/brianwu/Documents/codex/coffeelog/components/AICoach.tsx)

功能：

- 建立聊天互動
- 向 chat endpoint 發送請求
- 呈現 AI 回覆

---

## 6. 分析邏輯

分析工具集中於 [lib/data.ts](/Users/brianwu/Documents/codex/coffeelog/lib/data.ts)。

目前包含：

- `startOfDay`
- `formatDateInputValue`
- `getAverageCupScore`
- `buildAnalyticsSnapshot`

### 分析快照內容

`buildAnalyticsSnapshot` 會輸出：

- `rangeLabel`
- `scopedRecords`
- `trendPoints`
- `totalCups`
- `activeDays`
- `highScoreCount`
- `averageScore`
- `lowScoreRecords`
- `bestRecipes`
- `equipmentComparison`

---

## 7. 主題系統

### 目前模式

- 深色模式
- 明亮模式

### 控制方式

- 由 [components/ThemeProvider.tsx](/Users/brianwu/Documents/codex/coffeelog/components/ThemeProvider.tsx) 管理
- 使用 `localStorage` 記住使用者選擇
- 將主題寫入 `document.documentElement.dataset.theme`
- 更新 `theme-color` meta

### 切換控制

- [components/ThemeToggle.tsx](/Users/brianwu/Documents/codex/coffeelog/components/ThemeToggle.tsx)

---

## 8. 導航結構

### 頁面層

- `/`
- `/beans`
- `/equipment`
- `/brew`
- `/brew/new`
- `/records`
- `/records/detail`
- `/settings`
- `/privacy`
- `/support`

### 底部導覽

由 [components/BottomNav.tsx](/Users/brianwu/Documents/codex/coffeelog/components/BottomNav.tsx) 提供：

- 首頁
- 豆單
- 器具
- 沖煮
- 紀錄
- 設定

---

## 9. 目前的 UI / UX 方向

目前專案已從早期的展示式風格，逐步收斂到：

- iOS native 導向
- 支援 light / dark theme
- local-first 工具型 app
- dashboard + grouped list 混合架構

### 已完成的方向

- 主題切換
- 分析面板
- 高密度清單
- grouped form
- tactile slider
- 安全區處理

### 尚可持續優化的方向

- 首頁進一步貼近 iOS 原生 dashboard 節奏
- 明亮模式的視覺語言再精修
- 全站 grouped inset list 規則更一致
- card / list / sheet 的層級系統進一步統一

---

## 10. 建議閱讀順序

如果要快速理解這個專案，建議按這個順序看：

1. [PROJECT_ARCHITECTURE_AND_FEATURES.md](/Users/brianwu/Documents/codex/coffeelog/PROJECT_ARCHITECTURE_AND_FEATURES.md)
2. [lib/db.ts](/Users/brianwu/Documents/codex/coffeelog/lib/db.ts)
3. [lib/data.ts](/Users/brianwu/Documents/codex/coffeelog/lib/data.ts)
4. [app/layout.tsx](/Users/brianwu/Documents/codex/coffeelog/app/layout.tsx)
5. [app/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/page.tsx)
6. [app/brew/new/BrewFormClient.tsx](/Users/brianwu/Documents/codex/coffeelog/app/brew/new/BrewFormClient.tsx)
7. [app/records/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/records/page.tsx)
8. [app/records/detail/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/records/detail/page.tsx)
9. [app/settings/page.tsx](/Users/brianwu/Documents/codex/coffeelog/app/settings/page.tsx)

---

## 11. 文件用途

這份文件的目的，是讓任何新接手的人可以在一份文件中快速理解：

- 這個 app 是什麼
- 用什麼技術做的
- 資料怎麼存
- 功能有哪些
- 目前 UI / UX 的方向是什麼
- 之後應該從哪裡開始看
