# Shared Task Sample

This package is the first concrete sample for `firestore-type`.

It demonstrates:

- domain vs persisted separation
- `schemaVersion` on every persisted document
- a pure `v0 -> v1` migration
- `Date` in the domain layer
- `TimestampLike` only at the persisted boundary
- write-side timestamp factories via `toPersisted(..., toTimestamp)`

## Files

- `src/models/task.ts`: Task domain model, persisted shapes, validator, migration, and model spec
- `src/index.ts`: re-export entrypoint for the sample package

## Domain Shape

```ts
interface Task {
  title: string;
  done: boolean;
  dueAt?: Date;
  priority: "low" | "medium" | "high";
}
```

## Persisted Shapes

- `TaskPersistedV0`: legacy shape using `completed` and `dueDate`
- `TaskPersistedV1`: current shape using `done`, `dueAt`, and `priority`

## Migration

`migrateTaskV0ToV1` performs one pure persisted-shape upgrade:

- `completed -> done`
- `dueDate -> dueAt`
- default `priority: 'medium'`

## Intended Consumers

- `samples/web-app/`: will reuse this model with the Firebase Web SDK and `firestore-type/react`
- `samples/firebase-function/`: will reuse this model with the Admin SDK and `firestore-type/adapters/firebase-admin`

## Type Checking

```bash
pnpm --dir samples/shared run check
```

The sample `tsconfig.json` includes local path mappings so it can typecheck against the in-repo library source during development.
