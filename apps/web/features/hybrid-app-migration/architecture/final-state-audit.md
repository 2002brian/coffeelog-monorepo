# CoffeeLog Final State Audit

## Audit Scope

This report audits the current frontend application state of CoffeeLog after the architectural split into:

- a local-first Capacitor-compatible PWA frontend
- an external cloud AI inference microservice

The review covers five dimensions:

1. Local-first data layer
2. AI streaming protocol integration
3. Static export and Capacitor readiness
4. Tech debt and orphaned files
5. UI and styling consistency

## Executive Verdict

CoffeeLog is now structurally close to the intended hybrid architecture.

The core migration is successful:

- Prisma is removed from source code
- Dexie V2 is active and typed around UUIDs
- the frontend is statically exportable
- the AI client has been externalized and upgraded to `useChat`

However, the system is not yet fully clean.

The main remaining issues are:

1. backend-era dependencies are still present in `package.json`
2. legacy IndexedDB tables remain in `lib/db.ts` for upgrade purposes, which is correct, but they should be treated as transitional
3. UI consistency is mostly good, but safe-area handling is standardized by spacing convention rather than true `env(safe-area-inset-top)` support

## Final Health Score

**8.6 / 10**

### Score Breakdown

| Dimension | Score | Notes |
| --- | --- | --- |
| Local-first data layer | 8.5 | V2 schema is solid, but migration still depends on a one-time bridge from legacy tables |
| AI streaming integration | 9.0 | `useChat` is correctly adopted, but payload minimization and dependency cleanup remain |
| Static export compatibility | 9.5 | Source tree is clean for `output: "export"` |
| Tech debt cleanup | 7.5 | Unused backend packages remain |
| UI and styling consistency | 8.5 | Visual language is coherent, safe-area treatment is not yet fully systemized |

## 1. Local-First Data Layer

### Schema V2 Status

`lib/db.ts` now defines the active V2 entities as:

- `CoffeeBean`
- `Equipment`
- `BrewRecord`

The important V2 characteristics are present:

- all primary keys are `string`
- `createdAt` and `updatedAt` exist on all entities
- `BrewRecord` uses `beanId: string`
- `BrewRecord` uses `equipmentId: string`
- legacy string-based `equipment` has been removed from the active schema

### Active Dexie Tables

The active tables are:

- `beansV2`
- `equipmentsV2`
- `brewRecordsV2`

The active indexes are:

```ts
beansV2: "id, createdAt, updatedAt, name, origin"
equipmentsV2: "id, createdAt, updatedAt, type, name"
brewRecordsV2: "id, createdAt, updatedAt, beanId, equipmentId"
```

This is structurally consistent with the current product requirements.

### CRUD Coverage Check

All active CRUD paths are using Dexie V2:

| Area | Read Path | Write Path | Status |
| --- | --- | --- | --- |
| Beans | `app/beans/page.tsx` | `app/beans/BeansClient.tsx` | Healthy |
| Equipment | `app/equipment/page.tsx` | `app/equipment/new/page.tsx` | Healthy |
| Brew records | `app/records/page.tsx`, `app/records/detail/page.tsx` | `app/brew/new/BrewFormClient.tsx` | Healthy |

### Join Integrity Check

#### `BrewRecord -> CoffeeBean`

This is now key-based and correct:

- `record.beanId`
- `db.beansV2.get(record.beanId)`
- in list pages, records are joined through an in-memory `Map<string, CoffeeBean>`

This is the correct local-first pattern for Dexie.

#### `BrewRecord -> Equipment`

This has been properly repaired in V2:

- `record.equipmentId`
- `db.equipmentsV2.get(record.equipmentId)`

This closes the earlier integrity bug where records depended on equipment name strings.

### Migration Bridge Review

`lib/db.ts` still contains legacy `version(1)` tables and an upgrade bridge:

- `coffeeBeans`
- `equipment`
- `brewRecords`

This is correct for migration and should not be treated as an active architectural problem.

The `version(2).upgrade()` logic does the following:

1. reads old records
2. generates UUIDs
3. maps old numeric `beanId` to new UUIDs
4. maps old equipment names to new equipment UUIDs
5. writes migrated records into V2 tables

This is the right approach for a one-time client-side IndexedDB migration.

### Data Layer Risks

There are still two notable risks:

1. migration uses equipment name matching, so duplicate legacy equipment names can collapse into ambiguous mappings
2. there is still no `isDeleted`, `syncStatus`, or revision field, so the schema is not yet sync-ready

### Verdict

The local-first data layer is operational and well-aligned with the current app.

It is no longer blocked by Prisma assumptions, and the key relation defect has been fixed.

## 2. AI Streaming Protocol

### `AICoach` Integration Status

`components/AICoach.tsx` has been modernized correctly:

- imports `useChat` from `@ai-sdk/react`
- uses `DefaultChatTransport` from `ai`
- removes all manual `fetch` + `ReadableStream` + `TextDecoder` parsing
- uses `status` from the AI SDK instead of a custom loading state machine

This is the correct architectural direction.

### Payload Structure Check

The frontend sends:

```ts
{
  localContext
}
```

through:

```ts
sendMessage(
  { text: userText },
  {
    body: {
      localContext,
    },
  }
)
```

`localContext` is typed from `lib/db.ts`:

- `record: BrewRecord`
- `bean: CoffeeBean | null`
- `equipment: Equipment | null`

This is aligned with Dexie V2 and correctly reflects the UUID-based schema.

### Sensitive Data Review

The payload does not currently expose obvious credentials or secrets.

What it does expose:

- brew parameters
- bean metadata
- equipment metadata
- user tasting feedback

This is functionally required for the AI use case.

What is not exposed:

- API keys
- user auth state
- device tokens
- IndexedDB internals

This is acceptable.

### Payload Minimization Assessment

The payload is safe, but not minimal.

The AI route currently receives full entity objects rather than a distilled prompt context object.

This is not a security issue, but it is slightly broader than necessary. For example:

- `createdAt`
- `updatedAt`
- UUIDs

are not needed for coaching output.

Recommendation:

Introduce a transport DTO later, for example:

```ts
type ChatContextPayload = {
  bean: { name; origin; roastLevel; process; notes }
  equipment: { name; type; brand }
  record: { dose; water; temperature; brewTime; grindSize; bloomTime; acidity; sweetness; body; bitterness; feedback }
}
```

### Endpoint Handling Review

`AICoach` reads:

```ts
process.env.NEXT_PUBLIC_AI_CHAT_ENDPOINT
```

and refuses submission if the endpoint is absent.

This is correct for a statically exported Capacitor app. The endpoint is public by design and must be public because the frontend calls it directly.

This is safe as long as:

- only the endpoint URL is public
- no secret is embedded in the client

### Verdict

The AI streaming protocol integration is architecturally correct and modern.

This is no longer a hand-rolled streaming client. It is now aligned with the Vercel AI SDK contract.

## 3. Static Export & Capacitor Compatibility

### Next.js Static Export Check

`next.config.ts` contains:

```ts
output: "export"
```

and the source tree is consistent with that requirement.

### Route Structure Audit

Current routes are static-compatible:

- `/`
- `/beans`
- `/brew`
- `/brew/new`
- `/equipment`
- `/equipment/new`
- `/records`
- `/records/detail`
- `/manifest.webmanifest`

There are no active dynamic segment routes such as:

- `[id]`
- catch-all server routes

The former record detail route has already been converted to:

```txt
/records/detail?id=...
```

which is appropriate for static export.

### Server Actions Audit

No `actions.ts` files remain in the active app tree.

No `"use server"` directives were found in source.

This is correct and required.

### API Route Audit

There is no active `app/api/*` route in the source tree.

This is correct for the new architecture because the cloud AI service is now external.

### Metadata / Manifest Check

`app/manifest.ts` includes:

```ts
export const dynamic = "force-static";
```

This is correct under `output: "export"`.

### Capacitor Configuration Check

`capacitor.config.ts` is clean and standard:

```ts
appId: "com.brianwu.coffeelog"
appName: "CoffeeLog"
webDir: "out"
server: {
  androidScheme: "https"
}
```

This is correct for a statically built app where Next output goes to `out/`.

### Static Export Verdict

The frontend project is now structurally compliant with static export and Capacitor packaging.

This is one of the strongest parts of the current architecture.

## 4. Tech Debt & Orphaned Files

### Source-Level Backend Debt

The source tree is clean in the following areas:

- no Prisma source imports
- no `@prisma/client` imports
- no active `app/api/*`
- no Server Actions
- no route handlers in the app tree

This means the architectural split is real, not partial.

### Package-Level Debt

The following packages appear to be removable from the frontend app:

| Package | Why it looks removable |
| --- | --- |
| `@ai-sdk/openai` | Cloud AI is now external; the frontend does not call model providers directly |
| `openai` | No source import in the frontend project |
| `pg` | No source import; database is Dexie-only |
| `dotenv` | No active runtime use in the frontend app |
| `@types/pg` | Only needed if `pg` remains |

### AI Package Review

Packages currently justified:

- `ai`
- `@ai-sdk/react`

Packages that look legacy:

- `@ai-sdk/openai`
- `openai`

If the cloud brain is truly a separate repo, these should be removed from this app.

### Node Module Orphans

The workspace scan found residual generated artifacts in `node_modules`:

- `node_modules/.prisma/client/*`

This is not a source-level architecture issue, but it is stale residue from the old stack.

Recommendation:

- remove `node_modules`
- reinstall cleanly

### File Tree Orphans

The source tree does **not** currently contain:

- `actions.ts`
- `app/api/*`
- `prisma/`
- `schema.prisma`

This is good.

### Verdict

The main technical debt is no longer code structure. It is dependency hygiene.

## 5. UI & Styling Consistency

### Container Consistency

Core list and form pages mostly share the same outer spacing pattern:

```txt
mx-auto
px-4
py-10
sm:px-6
```

Headers are also mostly standardized around:

```txt
space-y-3
pt-4
```

This is consistent across:

- home
- beans
- records
- equipment
- new equipment
- new brew

### Safe Area Review

Important nuance:

- spacing is now visually consistent
- but it is not truly safe-area aware through `env(safe-area-inset-top)`

That means the project currently uses **layout convention**, not **device-aware safe-area logic**.

This is acceptable if your current Capacitor shell and top chrome already create enough inset, but it is not the strongest long-term mobile strategy.

### Glassmorphism Consistency

The dominant card pattern is consistent:

- `rounded-[24px]` or `rounded-3xl`
- `border border-white/80`
- `bg-white/60` or `bg-white/50`
- `shadow-[0_8px_30px_rgb(51,68,85,0.06)]`
- `backdrop-blur-xl`

This creates a coherent visual system.

### Remaining Styling Inconsistencies

There are still minor inconsistencies:

1. page widths vary between `max-w-3xl` and `max-w-5xl`
2. some cards use `rounded-[24px]`, others use `rounded-3xl`
3. some headers include an eyebrow label, some do not
4. safe-area handling is not centralized in a shared layout utility or wrapper component

These are not severe, but they are visible at design-system level.

### Verdict

The UI system is coherent enough to feel like one product, but it is not yet fully tokenized or centralized.

## Immediate Action Items

### P0

1. Remove unused backend-era packages from `package.json`:
   - `@ai-sdk/openai`
   - `openai`
   - `pg`
   - `dotenv`
   - `@types/pg`
2. Delete `node_modules` and reinstall once to flush stale `.prisma` artifacts

### P1

1. Introduce a reduced `ChatContextPayload` DTO so the frontend sends only the fields the cloud AI actually needs
2. Add sync-ready fields to Dexie entities in the next schema version:
   - `isDeleted`
   - `syncStatus`
   - `lastSyncedAt`
   - optional `version`

### P2

1. Centralize page shell spacing into a shared page container component
2. Decide whether top spacing should remain convention-based or become true safe-area aware
3. Normalize design tokens for radius and glass card variants

## Final Conclusion

CoffeeLog is now in a good final-state posture for the current milestone.

The frontend is:

- local-first
- statically exportable
- Capacitor-ready
- AI-service decoupled
- no longer burdened by the old Prisma/server architecture

What remains is not a re-architecture. It is cleanup and hardening.

That is the correct place for the project to be at this stage.
