# Firestore-type TODO

## Current status (implemented)

### Design and architecture

- ✅ Design authority document created (`docs/firestore-object-toolkit-design.md`)
- ✅ Detailed design chat docs committed (`docs/detailed-chat-docs/`)
  - `design-chat.md` — three-representation model (Domain, Persisted, Migrated)
  - `migration-philosophy.md` — migration-on-read philosophy and rules
  - `agent-guidance.md` — hard constraints and agent strategy
- ✅ Implementation plan committed (`docs/claude-implementation-plan.md`)

### Core slice (`src/core`)

- ✅ `PersistedBase`, `Migration`, `ModelSpec`, and `ToTimestamp` type contracts
- ✅ `ModelSpec.toPersisted` accepts optional `toTimestamp?: ToTimestamp` factory
  so callers can convert `Date → Timestamp` at the adapter boundary without
  importing Firebase inside model definitions
- ✅ `defineModel(spec)` identity helper
- ✅ Migration/read helpers: `assertSchemaVersion`, `migratePersisted`, `readDomain`
- ✅ Validation helpers: `assertObject`, `assertNumber`, `createValidator`

### Shared types (`src/types.ts`)

- ✅ `DocumentData`, `TypedDocumentSnapshot`, `TypedQuerySnapshot`, `getDocumentData`
  extracted into their own module (avoids circular imports with adapters)

### Time slice (`src/time`)

- ✅ Duck-typed `TimestampLike` and `TimestampFactory` interfaces
- ✅ `ToTimestamp` type exported from `src/core/types.ts` (uses `TimestampLike`)
- ✅ Conversion helpers: `dateFromTimestamp`, `timestampFromDate`

### Adapters (`src/adapters`)

- ✅ `firebase-client` — real implementation (not a placeholder):
  - `BrowserDocumentSnapshot<T>` / `BrowserQuerySnapshot<T>` interfaces
  - `toTypedSnapshot`, `toTypedQuerySnapshot`
  - `readDocumentDomain` — full migration-on-read flow at the adapter boundary
- ✅ `firebase-admin` — real implementation (not a placeholder):
  - `AdminDocumentSnapshot<T>` / `AdminQuerySnapshot<T>` interfaces
  - `toTypedSnapshot`, `toTypedQuerySnapshot`
  - `readDocumentDomain` — full migration-on-read flow at the adapter boundary

### Packaging and exports

- ✅ All subpath exports configured and built via tsup:
  - `.` (main), `./core`, `./time`
  - `./adapters/firebase-client`, `./adapters/firebase-admin`
- ✅ Peer dependencies: `firebase >=10.0.0` (optional), `firebase-admin >=12.0.0` (optional)

### Tests and build

- ✅ **68 Vitest tests** across 4 files (unified — node:test runner removed):
  - `src/core/core.test.ts` (32) — all core helpers, migration paths, validation
  - `src/time/time.test.ts` (11) — all timestamp shapes, edge cases
  - `src/adapters/adapters.test.ts` (22) — both adapters, all public functions
  - `src/index.test.ts` (3) — `getDocumentData`
- ✅ `pnpm build`, `pnpm test`, `pnpm lint` all pass

---

## Remaining work (not implemented yet)

### Phase 4 — Samples directory

- ✅ `samples/shared/` — shared `Task` domain model (v0→v1 migration, timestamps)
- ⏳ `samples/web-app/` — React + Vite app demonstrating full read/write flow with firebase-client adapter
- ⏳ `samples/firebase-function/` — Cloud Function demonstrating migration-on-read with firebase-admin adapter

### Docs housekeeping

- ✅ Create `docs/design.md` alias/copy of `firestore-object-toolkit-design.md`
  (agent-guidance.md references this path as authoritative)
- ✅ Create `docs/migration-philosophy.md` alias for the migration philosophy authority doc

### Validation ergonomics

- ⏳ Add higher-level validator composition helpers for common persisted patterns
- ⏳ Add examples for integrating external runtime validators (zod/valibot/yup) without hard dependency

### Migration ergonomics and safety

- ⏳ Improve migration typing so individual steps can be typed per version
  without `any` in the migrations map
- ⏳ Add helper for detecting non-advancing migrations (defensive check that a
  step increments `schemaVersion`)

### Documentation and developer experience

- ✅ Expand README with quickstart and link to user guide
- ⏳ Add API reference docs for each exported symbol

### Project quality

- ⏳ Add linting/formatting setup (eslint + prettier)
- ⏳ Add CI workflow for build + tests
- ⏳ Add release/versioning workflow
