# `@bridgenodelabs/firestore-models` — Write Support Spec

**Status:** Proposed  
**Date:** 2026-04-19

## Background

The library has a strong read path:

```txt
snapshot -> validatePersisted -> migratePersisted -> fromPersisted -> domain
```

The write path is weaker:

- callers typically use `model.toPersisted(...)` directly for full writes
- partial updates are usually hand-built as `DocumentData`
- the React hook exposes `updatePersistedById(id, patch: Partial<PersistedLatest>)`

That leaves a gap between what the read side guarantees and what the write side
allows. A caller can write a partial persisted patch that omits required fields
or bypasses model conversion rules, and Firestore will accept it. The failure
only appears on the next read when validation or hydration runs.

The concrete failure that exposed this gap was a partial write that omitted
`schemaVersion` and other required persisted fields. Firestore accepted the
write; the next read threw during validation.

## Problem Statement

The current library has no first-class write contract that answers these
questions:

1. How should a caller create a full persisted document from a domain object?
2. How should a caller build a partial update without bypassing model logic?
3. How should create/update/upsert timestamp semantics be handled?
4. How should the React mutation hook participate in the same rules?

The existing draft spec overreaches in a few places:

- it assumes adapters can detect timestamp fields automatically
- it assumes core should model Firestore `FieldValue` sentinels directly
- it treats `createWritePatch` as sufficient for partial updates, when it only
  protects full-document writes

Those assumptions do not match the current design in [design.md](/Users/toddwseattle/dev/firestore-models/docs/design.md):

- core is SDK-agnostic
- timestamp conversion happens through explicit model logic plus `ToTimestamp`
- adapters are thin wrappers, not schema interpreters

## Goals

1. Preserve the library's core design: model-defined conversion, migration on
   read, SDK-agnostic core.
2. Add a write path that is as explicit as the read path.
3. Make safe full writes easy.
4. Make partial updates possible without forcing callers to hand-build
   persisted patches.
5. Keep the change additive and compatible with existing models.
6. Extend the React mutations surface so its safest path uses the model too.

## Non-Goals

1. Do not add runtime schema introspection for persisted fields.
2. Do not make core depend on Firebase client or admin types.
3. Do not attempt to validate arbitrary Firestore sentinel behavior in core.
4. Do not remove low-level escape hatches for callers who intentionally manage
   raw persisted writes themselves.

## Proposed API

### 1. Extend `ModelSpec` with optional update conversion

Current `ModelSpec` already owns the domain-to-persisted conversion for full
writes via `toPersisted(domain, toTimestamp?)`. Partial updates need an
equivalent model-owned conversion point.

Add one optional function:

```ts
export interface ModelSpec<Domain, PersistedLatest extends PersistedBase> {
  currentVersion: number;
  toPersisted: (domain: Domain, toTimestamp?: ToTimestamp) => PersistedLatest;
  fromPersisted: (persisted: PersistedLatest) => Domain;
  migrations?: Record<number, Migration<any, any>>;
  validatePersisted?: (value: unknown) => void;

  /**
   * Optional conversion for partial domain updates.
   *
   * Use this when the persisted representation differs from the domain shape,
   * when update-only fields must be injected, or when timestamp handling needs
   * to differ between create and update operations.
   */
  toPartialPersisted?: (
    patch: Partial<Domain>,
    toTimestamp?: ToTimestamp,
  ) => Partial<PersistedLatest>;
}
```

Why this shape:

- it matches the current library pattern: the model owns conversion
- it stays additive
- it does not require adapters to infer schema or timestamp fields
- it supports simple models and complex ones

### 2. Add core helpers for safer write construction

Core should provide compile-time helpers for the two distinct cases: full
persisted writes and partial persisted writes.

```ts
export function createPersistedWrite<
  Domain,
  PersistedLatest extends PersistedBase,
>(
  _spec: ModelSpec<Domain, PersistedLatest>,
  value: PersistedLatest,
): PersistedLatest;

export function createPersistedUpdate<
  Domain,
  PersistedLatest extends PersistedBase,
>(
  _spec: ModelSpec<Domain, PersistedLatest>,
  patch: Partial<PersistedLatest>,
): Partial<PersistedLatest>;
```

These are typed identity helpers.

Intent:

- `createPersistedWrite(...)` catches missing required fields on full writes
- `createPersistedUpdate(...)` makes raw persisted partial updates explicit
- neither helper claims to solve domain-to-persisted conversion

This is narrower than the original `WithFieldValues<T>` idea and fits the
current codebase better. The first implementation can stay SDK-neutral and
avoid inventing a cross-adapter `FieldValueSentinel` abstraction.

### 3. Add adapter write helpers for domain-driven writes

The adapter layer should grow write helpers that mirror the existing read
helpers. These helpers stay thin and reuse model conversion.

#### Firebase client adapter

Add:

```ts
export async function createDocumentDomain<
  Domain,
  PersistedLatest extends PersistedBase,
>(
  ref: { set(data: PersistedLatest): Promise<unknown> } | unknown,
  domain: Domain,
  spec: ModelSpec<Domain, PersistedLatest>,
  options?: { toTimestamp?: ToTimestamp },
): Promise<void>;

export async function setDocumentDomain<
  Domain,
  PersistedLatest extends PersistedBase,
>(
  ref: unknown,
  domain: Domain,
  spec: ModelSpec<Domain, PersistedLatest>,
  options?: { toTimestamp?: ToTimestamp; merge?: boolean },
): Promise<void>;

export async function updateDocumentDomain<
  Domain,
  PersistedLatest extends PersistedBase,
>(
  ref: unknown,
  patch: Partial<Domain>,
  spec: ModelSpec<Domain, PersistedLatest>,
  options?: { toTimestamp?: ToTimestamp },
): Promise<void>;
```

Behavior:

- `createDocumentDomain` converts with `toPersisted` and performs a full write
- `setDocumentDomain` converts with `toPersisted` and forwards optional merge
  behavior
- `updateDocumentDomain` requires `spec.toPartialPersisted`; otherwise it throws
  a descriptive error telling the caller to supply `toPartialPersisted` or use a
  raw persisted update helper

Important constraint:

- adapters do not inspect field types or auto-rewrite timestamps
- timestamp behavior remains model-owned through `toPersisted` and
  `toPartialPersisted`

#### Firebase admin adapter

Add the same three functions with the admin SDK's structural types.

### 4. Add opt-in raw persisted update helpers at the adapter boundary

There are still valid cases where callers already have a persisted patch. The
library should support that explicitly instead of pretending every write is
domain-driven.

Add:

```ts
export async function updateDocumentPersisted<PersistedLatest extends PersistedBase>(
  ref: unknown,
  patch: Partial<PersistedLatest>,
): Promise<void>;
```

This helper is intentionally thin. Its value is naming and type clarity: a
caller chooses a raw persisted update on purpose.

### 5. Extend the React mutation hook

The biggest user-facing write surface in this package today is
[`useFirestoreMutations.ts`](/Users/toddwseattle/dev/firestore-models/src/react/useFirestoreMutations.ts).
Any write-support story that ignores it is incomplete.

Current hook methods:

- `create(domain)`
- `setById(id, domain, options?)`
- `updatePersistedById(id, patch)`
- `deleteById(id)`

Proposed additions:

```ts
updateById(id: string, patch: Partial<Domain>): Promise<void>;
setPersistedById(
  id: string,
  value: PersistedLatest,
  options?: SetOptions,
): Promise<void>;
```

Behavior:

- `updateById` uses `model.toPartialPersisted` and is the preferred update path
- `updatePersistedById` stays for escape-hatch use and existing compatibility
- `setPersistedById` is the explicit raw persisted full-write escape hatch

This gives the hook the same split as the adapters:

- domain-first safe path
- explicit raw persisted path

### 6. Defer true upsert semantics

The earlier draft proposed a transaction-based `upsertDocumentDomain` that
preserves `createdAt` while always updating `updatedAt`.

That behavior is useful, but it should be deferred from the initial
implementation for two reasons:

1. the current codebase does not yet have a write policy abstraction for common
   metadata fields like `createdAt` / `updatedAt`
2. once introduced, upsert semantics need to be consistent across client,
   admin, and React surfaces

The first write-support release should establish the conversion contract first:

- full domain write
- partial domain update
- explicit raw persisted update

`upsertDocumentDomain` can be added later as a second-phase feature once the
library has a clearer story for metadata policies.

## Recommended Usage Patterns

### Full document create/set

```ts
const persisted = taskModel.toPersisted(task, Timestamp.fromDate);
await setDoc(ref, createPersistedWrite(taskModel, persisted));
```

Or with the adapter helper:

```ts
await setDocumentDomain(ref, task, taskModel, {
  toTimestamp: Timestamp.fromDate,
});
```

### Partial domain update

```ts
const taskModel = defineModel<Task, TaskDocumentV1>({
  currentVersion: 1,
  toPersisted: ...,
  toPartialPersisted: (patch, toTimestamp) => ({
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.done !== undefined ? { done: patch.done } : {}),
    ...(patch.dueAt !== undefined
      ? {
          dueAt:
            patch.dueAt === undefined
              ? undefined
              : timestampFromDate(patch.dueAt, toTimestamp!),
        }
      : {}),
  }),
  fromPersisted: ...,
});

await updateDocumentDomain(ref, { done: true }, taskModel, {
  toTimestamp: Timestamp.fromDate,
});
```

### Explicit raw persisted update

```ts
await updateDocumentPersisted(ref, createPersistedUpdate(taskModel, {
  done: true,
}));
```

## Compatibility and Migration

All changes in this spec are additive.

### Existing model authors

- no action required for read-only usage
- no action required for full-write usage based on `toPersisted`
- add `toPartialPersisted` only if you want model-driven partial updates

### Existing adapter users

- current read helpers remain unchanged
- new write helpers are available as opt-in convenience APIs

### Existing React hook users

- current methods remain supported
- `updateById` becomes the recommended path for model-driven updates
- `updatePersistedById` remains available for advanced cases

## Acceptance Criteria

1. `ModelSpec` supports optional `toPartialPersisted`.
2. Core exports `createPersistedWrite` and `createPersistedUpdate`.
3. Firebase client and admin adapters export domain-driven write helpers.
4. Adapter write helpers do not rely on timestamp-field introspection.
5. React `useFirestoreMutations` supports domain-driven partial updates.
6. Existing read APIs remain unchanged.
7. Existing consumers compile without adding `toPartialPersisted`.
8. Tests cover:
   - full write conversion through `toPersisted`
   - partial update conversion through `toPartialPersisted`
   - failure when `updateDocumentDomain` is called without
     `toPartialPersisted`
   - React hook behavior for `updateById`
   - raw persisted escape-hatch helpers

## Open Questions

1. Should `createPersistedUpdate` stay shallow (`Partial<T>`) or grow into a
   recursive partial type later? Firestore updates often need dotted paths or
   nested objects, and the first release can stay shallow to match current
   usage.
2. Should the adapter helpers be typed only structurally, as the current read
   helpers are, or import Firebase types directly? The existing package favors
   structural typing.
3. Should a later phase add metadata conventions for `createdAt` / `updatedAt`,
   or should that remain entirely model-specific?

## Summary

The write-side gap should be closed by extending the existing model contract,
not by teaching adapters to infer persisted schema rules.

The smallest coherent solution is:

- add `toPartialPersisted` to `ModelSpec`
- add core helpers for typed full and partial persisted writes
- add adapter helpers for full domain writes and partial domain updates
- extend `useFirestoreMutations` with a domain-driven update path

That keeps the package aligned with its current design: explicit model logic in
core, thin adapters around Firebase surfaces, and opt-in helper APIs rather
than hidden write magic.
