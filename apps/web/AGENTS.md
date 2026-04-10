# AGENTS.md

## UI / UX Workflow

When a task involves any of the following, prioritize using `.agents/skills/ui-ux-pro-max` before making code changes:

- UI design
- layout planning
- design systems
- color decisions
- typography
- information architecture
- interaction details
- accessibility
- dashboards
- landing pages
- application screens

Required flow:

1. Use the skill at `.agents/skills/ui-ux-pro-max`.
2. Run the skill's `search.py` first to generate a design direction for the task.
3. Review that design direction before editing any code.
4. Only then start implementing code changes.

If the task is UI-related and the skill or `search.py` is missing, stop and report the blocker before proceeding, unless the user explicitly tells you to continue without it.

## 核心工程規範 (Engineering Guidelines)

### 1. Framework & State Management (Next.js + Capacitor)
- **Local First**: 由於本專案為跨平台 PWA/iOS App，核心資料（如沖煮紀錄、豆單）必須優先寫入本地 `Dexie` (IndexedDB)。
- **State Boundary**: UI Component (如 `BrewFormClient.tsx`) 絕對禁止直接操作 Dexie。必須透過獨立的 `lib/data.ts` 或自訂 Hook (如 `useBrewLogs`) 進行資料存取。
- **Widget Sync**: 任何改變沖煮狀態的操作，都必須呼叫 `WidgetBridgeStore.sync()` 將最新摘要送往 iOS App Group。

### 2. Schema & Validation (資料驗證)
- **Strict Typing**: 所有的 User Input 在寫入資料庫前，必須通過嚴格的 Type 檢查（未來若導入 Zod，需強制經過 Schema Validation）。
- **Migration Rule**: 修改 Dexie Database 結構時，必須增加版本號 (`db.version(X)`) 並提供明確的 Upgrade 邏輯，絕對禁止破壞使用者現有的本地資料。

### 3. Component & Performance Constraints
- **Bundle Budget**: 新增套件時需評估大小。若無必要，不輕易引入大型圖表庫（如前次使用 SVG 手刻圖表即為最佳實踐）。
- **Accessibility (a11y)**: 所有自訂控制元件（如 `TactileSlider`）必須具備基礎的 aria-labels 與 touch-target 適配（最小 44px 高度）。