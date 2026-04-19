# Shared Task Sample

This package is the shared Task model sample for `@bridgenodelabs/firestore-models`.

It demonstrates:

- domain vs persisted separation
- `schemaVersion` on every persisted document
- a pure `v0 -> v1` migration
- `Date` in the domain layer
- `TimestampLike` only at the persisted boundary
- full domain writes via `toPersisted(..., toTimestamp)`
- partial domain updates via `toPartialPersisted(..., toTimestamp)`

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

## Write Model

- Use `taskModel.toPersisted(task, toTimestamp)` for full domain writes.
- Use `taskModel.toPartialPersisted(patch, toTimestamp)` for shallow partial domain updates.
- Keep `TimestampLike` values at the persisted boundary. The domain model stays on `Date`.

## Migration

`migrateTaskV0ToV1` performs one pure persisted-shape upgrade:

- `completed -> done`
- `dueDate -> dueAt`
- default `priority: 'medium'`

## Intended Consumers

- `samples/web-app/`: reuses this model with the Firebase Web SDK and `@bridgenodelabs/firestore-models/react`
- `samples/project-task-sample/`: reuses this model inside a transactional parent/subcollection write flow
- `samples/firebase-function/`: planned to reuse this model with the Admin SDK and `@bridgenodelabs/firestore-models/adapters/firebase-admin`

## Type Checking

```bash
pnpm --dir samples/shared run check
```

The sample `tsconfig.json` includes local path mappings so it can typecheck against the in-repo library source during development.
