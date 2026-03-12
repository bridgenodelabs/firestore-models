# Migration Philosophy

This file is the stable root-level alias for the migration guidance used by this project.

The authoritative detailed version also lives at `docs/detailed-chat-docs/migration-philosophy.md`.

## Problem Statement

Firestore allows any document shape at any time. Without discipline, this leads to schema drift, undetectable breaking changes, production-only failures, and fear of refactoring.

Migrations are the mechanism by which this library regains control over persisted history.

## Migration-on-Read

This library uses **migration-on-read**, not bulk backfills.

Why:

- Old documents may live for years.
- Backfills are risky and operationally expensive.
- Partial migrations create undefined states.

Migration-on-read guarantees:

- All domain logic sees the latest schema.
- Old data remains valid forever.
- No large batch jobs are required.

## Versioned Persistence

Every persisted document includes `schemaVersion: number`.

This allows:

- explicit detection of schema shape
- mechanical migration dispatch
- clear reasoning during debugging

## Migration Rules

- Migrations are pure functions.
- They never mutate inputs.
- They always return a newer schema.
- They never depend on domain logic.
- They are idempotent per version.

Example:

```ts
function migrateV1ToV2(old: PersistedV1): PersistedV2 {
  return {
    ...old,
    schemaVersion: 2,
    newField: defaultValue,
  };
}
```

## Validation as a Gate

Validation is optional but strongly encouraged.

It exists to:

- catch corrupted data
- detect manual Firestore edits
- fail fast instead of propagating bad state

Validation should happen before migration.

## Domain Isolation

Domain objects:

- never branch on `schemaVersion`
- never contain migration logic
- always assume the latest shape

This keeps business logic clean and stable.

## Mental Model

Firestore stores history.
Migrations translate history into the present.
