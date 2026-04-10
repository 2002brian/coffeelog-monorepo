# CoffeeLog Local-First Data Architecture Audit

## Scope

This audit reviews the current local-first architecture after the migration from Prisma/PostgreSQL to Dexie.js + IndexedDB, under Next.js static export (`output: "export"`) for Capacitor packaging.

The review covers four dimensions:

1. Schema and index design in `lib/db.ts`
2. Relational data flow in the Dexie-based frontend
3. Residual technical debt after Prisma and Server Action removal
4. Future-proofing requirements for cloud backup and multi-device sync

## Executive Summary

CoffeeLog has successfully crossed the critical migration boundary. The runtime data path is now browser-local, the app is statically exportable, and the main read/write workflows are client-side as required for IndexedDB.

The current architecture is healthy for a small to medium local dataset, but it still carries three structural weaknesses:

1. `BrewRecord` stores `equipment` as a string instead of a stable foreign key. This breaks referential integrity and makes equipment renames unsafe.
2. The schema is optimized for current list pages, but not yet for future filtered history views, sync workflows, or conflict resolution.
3. Several backend-era packages remain in `package.json` even though source-level Prisma and server-only logic have already been removed.

Overall assessment:

| Dimension | Status | Notes |
| --- | --- | --- |
| Local read/write architecture | Healthy | Dexie flows are working and correctly client-scoped |
| Schema correctness for current app | Acceptable | Good enough for current screens, but not sync-ready |
| Referential integrity | Weak | `equipment` string reference is the main issue |
| Static export compatibility | Healthy | No Prisma, no Server Actions, no Node-only route code in app tree |
| Cloud sync readiness | Not ready | Missing identity, timestamps, tombstones, and sync metadata |

## 1. Schema & Indexing Audit

### Current Schema

`lib/db.ts` defines three tables:

#### `CoffeeBean`

```ts
type CoffeeBean = {
  id?: number;
  name: string;
  origin: string;
  roastLevel: string;
  process: string;
  notes?: string | null;
  createdAt: number;
};
```

Dexie store:

```ts
coffeeBeans: "++id, createdAt, name, origin"
```

#### `Equipment`

```ts
type Equipment = {
  id?: number;
  name: string;
  type: string;
  brand?: string | null;
  createdAt: number;
};
```

Dexie store:

```ts
equipment: "++id, createdAt, type, name"
```

#### `BrewRecord`

```ts
type BrewRecord = {
  id?: number;
  beanId: number;
  dose: number;
  water: number;
  temperature: number;
  equipment: string;
  brewTime: number;
  grindSize?: string | null;
  bloomTime?: number | null;
  acidity: number;
  sweetness: number;
  body: number;
  bitterness: number;
  feedback?: string | null;
  createdAt: number;
};
```

Dexie store:

```ts
brewRecords: "++id, createdAt, beanId, equipment"
```

### Primary Key Review

The current use of `++id` is acceptable for a single-device local app. It keeps inserts simple and is performant in IndexedDB.

However, `++id` is not stable across devices and not suitable for future cloud sync, export/import merge, or conflict resolution. If two devices both create `id = 1`, the IDs are only locally unique, not globally unique.

### Index Review by Table

#### `coffeeBeans: "++id, createdAt, name, origin"`

Current usage:

- List page sorts by `createdAt desc`
- No filtering by `name` or `origin` is currently implemented

Assessment:

- `createdAt` is justified
- `name` and `origin` are currently speculative indexes
- These indexes are not harmful at current scale, but they are unused today

Recommendation:

- Keep `createdAt`
- Keep `name` only if search/autocomplete is near-term
- `origin` can be deferred unless filtering by origin is planned

#### `equipment: "++id, createdAt, type, name"`

Current usage:

- List page sorts by `createdAt desc`
- New brew form loads all equipment sorted by `createdAt desc`
- Detail page resolves equipment by `name`

Assessment:

- `createdAt` is justified
- `type` is only useful if type-based filtering is planned
- `name` is currently required only because `BrewRecord` stores a name string instead of `equipmentId`

Recommendation:

- Keep `createdAt`
- `name` is only compensating for a schema flaw
- If `BrewRecord` migrates to `equipmentId`, the `name` index becomes optional instead of structural

#### `brewRecords: "++id, createdAt, beanId, equipment"`

Current usage:

- Records list sorts by `createdAt desc`
- Detail page looks up one record by primary key
- No dedicated per-bean history page exists yet

Assessment:

- `createdAt` is correct and necessary
- `beanId` is a useful forward-looking index
- `equipment` is only indexed because the schema stores equipment by name

Recommendation:

- Keep `createdAt`
- Keep `beanId`
- Replace `equipment` with `equipmentId` in both schema and index design
- If per-bean history sorted by newest-first is planned, add a compound index such as `[beanId+createdAt]`

### Indexing Conclusion

The current index set is serviceable for the current UI. There is no severe under-indexing today.

The main issue is not index count. The main issue is schema shape:

- `beanId` is modeled as a relation key
- `equipment` is modeled as a denormalized string

That asymmetry is the largest structural inconsistency in the database layer.

## 2. Relational Data Flow Analysis

### How Relations Are Resolved Today

#### `BrewRecord -> CoffeeBean`

This path is relatively sound.

In `app/records/page.tsx`, the app loads all brew records and all beans in parallel:

```ts
const [brewRecords, beans] = await Promise.all([
  db.brewRecords.orderBy("createdAt").reverse().toArray(),
  db.coffeeBeans.toArray(),
]);
```

It then builds a `Map<number, CoffeeBean>` and joins in memory:

```ts
const beanMap = new Map(...)
return brewRecords.map((record) => ({
  ...record,
  bean: beanMap.get(record.beanId) ?? null,
}));
```

This avoids one query per record and is the correct pattern for local join emulation in Dexie.

#### `BrewRecord -> Equipment`

This path is weak.

In `app/records/detail/page.tsx`, the record is loaded first, then equipment is resolved by name:

```ts
const [bean, equipment] = await Promise.all([
  db.coffeeBeans.get(record.beanId),
  db.equipment.where("name").equals(record.equipment).first(),
]);
```

This means:

- there is no stable foreign key
- renaming equipment can orphan old brew records logically
- duplicate equipment names can create ambiguous matches

### N+1 Risk Assessment

#### Current `records` page

The current records list is not doing N+1 for beans. It bulk-loads all beans once and joins in memory. That is good.

Potential scaling issue:

- it loads all beans, not only referenced beans
- it loads all brew records, not paginated records

At small scale this is fine. At large scale this becomes a memory and transfer issue inside IndexedDB hydration and render.

#### Current `records/detail` page

The detail page loads one record, one bean, and one equipment. This is not a practical N+1 problem because it is a single-record screen.

#### Future risk

If future list pages begin showing equipment metadata or richer bean metadata per row, and the implementation evolves into repeated `db.get()` inside render loops, N+1 will appear quickly.

### Optimization Recommendations

#### Short-term

Use targeted bulk lookups rather than full-table reads when list sizes grow.

For example:

1. Load visible records
2. Extract unique `beanId`s
3. Use `bulkGet` for those bean IDs
4. Build a map locally

This is better than `db.coffeeBeans.toArray()` when the bean table becomes large.

#### Structural fix

Change `BrewRecord` from:

```ts
equipment: string;
```

to:

```ts
equipmentId: string | number;
```

or, preferably for sync-ready systems:

```ts
equipmentId: string;
```

Then resolve equipment the same way beans are resolved.

#### Snapshot strategy

For historical correctness, consider storing immutable snapshots inside `BrewRecord`, for example:

```ts
beanNameSnapshot
beanOriginSnapshot
equipmentNameSnapshot
equipmentTypeSnapshot
```

This avoids history drift when users edit the bean or equipment later. It also reduces the need for live joins on list pages.

### Relational Data Flow Conclusion

The app currently uses two different relation strategies:

- normalized key relation for beans
- denormalized string relation for equipment

This should be unified. The bean strategy is the better one. The equipment strategy is a temporary workaround and should be treated as technical debt.

## 3. Tech Debt Extermination Scan

### Prisma Residue

Source scan result:

- No Prisma imports found in `app`, `components`, or `lib`
- No `@prisma/*` usage found in source code
- No `PrismaClient` usage found in source code
- No `prisma/` schema folder remains in the working tree

Assessment:

- Prisma has been removed from source-level architecture successfully

### Server Actions Scan

Source scan result:

- No `"use server"` directives found

Assessment:

- Server Actions have been fully removed from the active app code
- This is correct for `output: "export"`

### Node-only Runtime Dependency Scan

Source scan result:

- No `fs`, `path`, `process.cwd`, or `node:` imports in `app`, `components`, or `lib`
- No active server route remains in the app tree

Assessment:

- The app runtime path is browser-compatible
- This is consistent with static export and Capacitor packaging

### Client Boundary Audit

All Dexie read/write surfaces are correctly client-scoped:

| File | Purpose | Client-scoped |
| --- | --- | --- |
| `app/beans/page.tsx` | list beans | Yes |
| `app/beans/BeansClient.tsx` | create bean | Yes |
| `app/equipment/page.tsx` | list equipment | Yes |
| `app/equipment/new/page.tsx` | create equipment | Yes |
| `app/records/page.tsx` | list records | Yes |
| `app/records/detail/page.tsx` | record detail + local joins | Yes |
| `app/brew/new/BrewFormClient.tsx` | create brew record | Yes |

Notes:

- `app/brew/new/page.tsx` is intentionally a server wrapper that only provides layout and `Suspense`
- Dexie access remains inside `BrewFormClient`, which is correct

### Remaining Package-Level Debt

While source-level Prisma residue is gone, several backend-era packages still remain in `package.json` without active imports in the app code:

- `openai`
- `ai`
- `@ai-sdk/openai`
- `pg`
- `dotenv`
- `@types/pg`

Assessment:

- These are not runtime blockers
- They do increase dependency surface and mental overhead
- If the cloud AI service is now fully externalized, these should be removed from the app repo unless they are intentionally reserved for a future separate worker package

### Tech Debt Conclusion

Application code is clean enough for a static local-first build.

The remaining debt is mostly package-level and schema-level, not runtime-level.

## 4. Future-Proofing for Cloud Sync

### Current Sync Readiness

The current schema is not ready for safe cloud backup or multi-device sync.

The missing primitives are:

- globally unique IDs
- mutation timestamps
- deletion markers
- sync state markers
- revision metadata

### Fields Missing for Sync

#### Stable global identity

Current:

```ts
id?: number; // local auto-increment
```

Problem:

- collisions across devices
- difficult merge/import semantics
- impossible to safely reconcile offline-created rows from multiple clients

Recommendation:

- replace `++id` with client-generated UUIDs
- use string primary keys

Example:

```ts
id: string;
```

#### Update timestamp

Current:

- only `createdAt`

Problem:

- cannot tell which version is newer
- cannot do last-write-wins or any revision ordering

Recommendation:

Add:

```ts
updatedAt: number;
```

#### Soft delete tombstone

Current:

- no deletion tracking

Problem:

- deletions cannot be synced safely
- a deleted item may be resurrected by another device during merge

Recommendation:

Add:

```ts
isDeleted: boolean;
deletedAt?: number | null;
```

#### Sync lifecycle state

Current:

- no sync metadata

Problem:

- app cannot distinguish local-only rows from synced rows
- retries, failed syncs, and conflict inspection are impossible

Recommendation:

Add:

```ts
syncStatus: "pending" | "synced" | "failed" | "conflict";
lastSyncedAt?: number | null;
syncError?: string | null;
```

#### Conflict metadata

Current:

- no revision or version control

Problem:

- conflict detection is guesswork

Recommendation:

Add one of:

```ts
version: number;
```

or:

```ts
revision: string;
```

or both local and remote revision markers if syncing to a document store.

### Schema Refactor Recommendation

A sync-ready shape should look more like this:

```ts
type BaseEntity = {
  id: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  deletedAt?: number | null;
  syncStatus: "pending" | "synced" | "failed" | "conflict";
  lastSyncedAt?: number | null;
  version: number;
};
```

Then:

```ts
type CoffeeBean = BaseEntity & { ... }
type Equipment = BaseEntity & { ... }
type BrewRecord = BaseEntity & { ... }
```

### BrewRecord Sync-Specific Advice

`BrewRecord` should not rely only on live relational lookups for historical meaning.

For future sync correctness, it should store both:

1. stable foreign keys
2. denormalized snapshots

Recommended direction:

```ts
type BrewRecord = BaseEntity & {
  beanId: string;
  equipmentId: string | null;
  beanNameSnapshot: string;
  beanOriginSnapshot: string;
  equipmentNameSnapshot?: string | null;
  equipmentTypeSnapshot?: string | null;
  ...
};
```

Why this matters:

- history remains readable after source entities are renamed
- sync conflict handling becomes simpler
- list rendering can avoid repeated joins

### Migration Strategy Recommendation

The safest migration path is incremental:

1. Introduce `updatedAt`, `isDeleted`, `syncStatus`, and UUID primary keys in a new Dexie version
2. Change `BrewRecord.equipment` to `equipmentId`
3. Add snapshot fields to `BrewRecord`
4. Write a migration that backfills existing local data
5. Only then design cloud sync protocol

## Final Assessment

### What is already strong

- Dexie has fully replaced Prisma in active application code
- Read/write flows are client-local and compatible with static export
- `useLiveQuery` is used correctly for current screens
- Records listing already avoids the worst N+1 pattern by performing an in-memory join map

### What should be fixed next

1. Replace `BrewRecord.equipment: string` with `equipmentId`
2. Add `updatedAt` to every entity immediately, even before cloud sync starts
3. Plan a move from `++id` to UUID-based primary keys
4. Add soft-delete and sync metadata fields before any cloud backup feature begins
5. Remove now-unused backend packages from the app repo if the cloud AI service is truly external

### Recommended Priority

| Priority | Action |
| --- | --- |
| P0 | Normalize `BrewRecord -> Equipment` relation to `equipmentId` |
| P1 | Add `updatedAt` to all entities |
| P1 | Design UUID-based IDs and Dexie migration strategy |
| P2 | Add tombstone and sync metadata fields |
| P2 | Add snapshot fields to `BrewRecord` |
| P3 | Remove unused backend-era dependencies from `package.json` |
