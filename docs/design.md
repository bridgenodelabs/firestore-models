# Firestore Object Toolkit Design

## Goals

A lightweight TypeScript library for converting between domain objects and Firestore-persisted documents while supporting schema evolution and timestamp normalization.

## Core Design Principles

1. **Domain vs Persisted separation**: domain objects are application-facing and may not include persistence metadata; persisted objects always include `schemaVersion`.
2. **Schema versioning everywhere**: every persisted document includes a numeric `schemaVersion`.
3. **Migration-on-read**: older documents are migrated to the latest schema before being converted to domain.
4. **Runtime validation hook**: optional validator runs before migrations/conversion.
5. **Timestamp normalization**: helpers support a duck-typed `TimestampLike` without importing Firebase SDK types.
6. **Optional Firebase adapters**: separate subpath exports for firebase client/admin integration to avoid hard dependency in core.

## Proposed Repository Structure

```txt
src/
  core/
    types.ts
    defineModel.ts
    migrate.ts
    validate.ts
    index.ts
  time/
    timestampLike.ts
    convert.ts
    index.ts
  adapters/
    firebase-client/
      index.ts
    firebase-admin/
      index.ts
  index.ts

docs/
  design.md
  firestore-object-toolkit-design.md
  migration-philosophy.md

samples/
  shared/
    src/
      models/
        task.ts
      index.ts
    README.md
  web-app/
  firebase-function/

tests live alongside source files as `src/**/*.test.ts`
```

## Documentation Map

- `docs/design.md`: stable alias for this design document when prompts or tools expect the short path.
- `docs/migration-philosophy.md`: stable alias for the migration philosophy deep-dive.
- `docs/user-guide.md`: user-facing usage guide and integration patterns.
- `samples/shared`: reusable Task model that demonstrates the design rules in code.

## Public API

### `src/core`

- `PersistedBase`: base persisted shape with `schemaVersion: number`.
- `Migration<From, To>`: function type for schema upgrades.
- `ModelSpec<Domain, PersistedLatest>`:
  - `currentVersion`
  - `toPersisted(domain, toTimestamp?)`
  - `fromPersisted(persistedLatest)`
  - `migrations?: Record<number, Migration<any, any>>`
  - `validatePersisted?: (value: unknown) => void`
- `ToTimestamp`: `(date: Date) => TimestampLike` write-boundary factory type.
- `defineModel(spec)`: typed identity helper for model creation.
- migration helpers:
  - `assertSchemaVersion`
  - `migratePersisted`
  - `readDomain` (validate + migrate + convert)
- validation helpers:
  - `assertObject`
  - `assertNumber`
  - `createValidator`

### `src/time`

- `TimestampLike`: duck-typed timestamp with optional `toDate`, `seconds/nanoseconds`, or `_seconds/_nanoseconds`.
- `TimestampFactory<T>`: `(date: Date) => T` for creating SDK timestamps externally.
- `dateFromTimestamp(input)`
- `timestampFromDate(date, factory)`

### Adapter Subpath Exports (optional)

- `firestore-type/adapters/firebase-client`
- `firestore-type/adapters/firebase-admin`

Each adapter exports:

- snapshot wrapper helpers: `toTypedSnapshot`, `toTypedQuerySnapshot`
- `readDocumentDomain(snapshot, spec)` to run the full read flow from a real Firestore snapshot

Adapters are optional wrappers that can be implemented by consumers or in-package with peer dependencies.

## Design Notes

- Domain objects use `Date`, not Firestore SDK timestamp classes.
- Timestamp conversion happens at the persistence boundary through `ToTimestamp` or `timestampFromDate`.
- Persisted document IDs live outside the persisted payload. Callers compose `snapshot.id` with the hydrated domain object when needed.
- Migrations are pure functions and operate on persisted shapes only.

## Migration-on-read Flow

1. Load unknown persisted data.
2. Run optional `validatePersisted` hook.
3. Ensure `schemaVersion` is valid.
4. Repeatedly apply migrations from current doc version to `currentVersion`.
5. Convert latest persisted object to domain via `fromPersisted`.

## Acceptance Criteria

- Core and time modules have no Firebase imports.
- Persisted docs are required to carry `schemaVersion`.
- Migration dispatcher applies ordered migrations and throws on invalid version or missing migration steps.
- Validation hook is optional and composable.
- Timestamp helpers work with multiple timestamp-like shapes.
- Adapter helpers bridge real Firestore snapshots into the read flow without introducing Firebase imports into `core` or `time`.
- Shared sample code demonstrates migration-on-read and timestamp conversion boundaries with one reusable Task model.
- Unit tests cover migration dispatch, invalid schemaVersion failures, and timestamp conversion helpers.
- `pnpm test` passes.
- `pnpm build` passes.
