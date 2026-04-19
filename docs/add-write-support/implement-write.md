# Implement Write Support

## Objective

Implement the write-side support described in
[firestore-models-write-spec.md](/Users/toddwseattle/dev/firestore-models/docs/add-write-support/firestore-models-write-spec.md)
without disturbing the current read-side API.

## Scope

This plan covers:

- `core` type additions
- Firebase client/admin adapter write helpers
- React hook updates
- tests and docs

This plan does not include:

- transaction-based upsert semantics
- automatic `createdAt` / `updatedAt` policies
- recursive `FieldValue` sentinel typing

## Implementation Plan

### 1. Extend `ModelSpec`

Files:

- [src/core/types.ts](/Users/toddwseattle/dev/firestore-models/src/core/types.ts)

Work:

1. Add optional `toPartialPersisted?: (patch, toTimestamp?) => Partial<PersistedLatest>`.
2. Keep `toPersisted` and all read-side members unchanged.
3. Update any generated `.d.ts` expectations through the normal build.

Notes:

- this is additive and should not break existing `defineModel(...)` calls
- keep the naming exactly aligned with the spec unless a repo-local naming
  conflict appears during implementation

### 2. Add core write helpers

Files:

- [src/core/write.ts](/Users/toddwseattle/dev/firestore-models/src/core/write.ts) new
- [src/core/index.ts](/Users/toddwseattle/dev/firestore-models/src/core/index.ts)
- [src/core/core.test.ts](/Users/toddwseattle/dev/firestore-models/src/core/core.test.ts)

Work:

1. Add `createPersistedWrite(spec, value)`.
2. Add `createPersistedUpdate(spec, patch)`.
3. Export both from `src/core/index.ts`.
4. Add tests proving:
   - helper returns the same object reference/value
   - helper signatures preserve type checking for full persisted writes
   - partial persisted updates are accepted

Notes:

- runtime behavior should stay trivial; these are type-oriented helpers
- if compile-time-only behavior is awkward to assert in Vitest, cover runtime
  identity in tests and rely on `tsc` for type enforcement

### 3. Add client adapter write helpers

Files:

- [src/adapters/firebase-client/index.ts](/Users/toddwseattle/dev/firestore-models/src/adapters/firebase-client/index.ts)
- [src/adapters/adapters.test.ts](/Users/toddwseattle/dev/firestore-models/src/adapters/adapters.test.ts)

Work:

1. Add `setDocumentDomain(...)`.
2. Add `createDocumentDomain(...)` as a thin non-merge full-write variant.
3. Add `updateDocumentDomain(...)`.
4. Add `updateDocumentPersisted(...)`.
5. Follow the package's current structural typing style instead of importing
   Firebase SDK runtime code.

Behavior details:

1. `setDocumentDomain`:
   - call `spec.toPersisted(domain, options?.toTimestamp)`
   - invoke the snapshot/reference-compatible `set` operation
2. `createDocumentDomain`:
   - same conversion path as `setDocumentDomain`
   - no merge semantics
3. `updateDocumentDomain`:
   - require `spec.toPartialPersisted`
   - throw a clear error if absent
   - call `spec.toPartialPersisted(patch, options?.toTimestamp)`
4. `updateDocumentPersisted`:
   - pass the patch through directly

Tests:

1. full domain write calls `toPersisted`
2. partial domain update calls `toPartialPersisted`
3. missing `toPartialPersisted` throws
4. raw persisted update bypasses model conversion

### 4. Mirror the same write helpers in the admin adapter

Files:

- [src/adapters/firebase-admin/index.ts](/Users/toddwseattle/dev/firestore-models/src/adapters/firebase-admin/index.ts)
- [src/adapters/adapters.test.ts](/Users/toddwseattle/dev/firestore-models/src/adapters/adapters.test.ts)

Work:

1. Add the same four functions for admin-style references.
2. Reuse as much shared local typing/pattern as practical without forcing a
   premature abstraction.

Notes:

- if the client/admin implementations end up nearly identical, a small internal
  shared helper is fine
- keep the public exports symmetric

### 5. Update React mutations

Files:

- [src/react/useFirestoreMutations.ts](/Users/toddwseattle/dev/firestore-models/src/react/useFirestoreMutations.ts)
- [src/react/useFirestoreMutations.test.ts](/Users/toddwseattle/dev/firestore-models/src/react/useFirestoreMutations.test.ts)
- [src/react/index.ts](/Users/toddwseattle/dev/firestore-models/src/react/index.ts) if export surface changes

Work:

1. Add `updateById(id, patch: Partial<Domain>)`.
2. Add `setPersistedById(id, value: PersistedLatest, options?: SetOptions)`.
3. Keep `updatePersistedById(...)` for compatibility.
4. Route `updateById` through `model.toPartialPersisted`.
5. Preserve existing error handling, pending state, `actionDocumentId`, and
   `stripUndefined` behavior.

Tests:

1. `updateById` converts through `toPartialPersisted`
2. `updateById` surfaces the missing-converter error
3. `setPersistedById` writes raw persisted data
4. existing tests for create/set/update/delete continue to pass

### 6. Update documentation

Files:

- [docs/user-guide.md](/Users/toddwseattle/dev/firestore-models/docs/user-guide.md)
- [docs/design.md](/Users/toddwseattle/dev/firestore-models/docs/design.md) only if the public design summary needs the write-side addition
- [docs/add-write-support/firestore-models-write-spec.md](/Users/toddwseattle/dev/firestore-models/docs/add-write-support/firestore-models-write-spec.md)

Work:

1. Add a write-side section to the user guide:
   - full domain write
   - partial domain update
   - raw persisted update
2. Document that partial domain updates require `toPartialPersisted`.
3. Keep `design.md` concise; only update it if the write path is now part of
   the stable architectural summary.

### 7. Verify

Commands:

```bash
pnpm test
pnpm build
pnpm lint
```

Expected result:

- tests pass
- typecheck passes
- package still builds with unchanged export map structure

## Suggested Delivery Order

1. `ModelSpec` type addition
2. core helpers
3. adapter write helpers
4. React hook changes
5. tests
6. docs
7. verification

## Risks

1. **Ambiguous partial update semantics**
   A `Partial<Domain>` does not always map cleanly to `Partial<PersistedLatest>`.
   The plan handles this by making `toPartialPersisted` model-owned and
   optional.

2. **Overlapping raw and domain write APIs**
   The package will expose both. Naming must stay explicit so users know which
   layer they are using.

3. **Nested update expectations**
   Some users may expect deep partial support or dotted-path updates. The first
   implementation should stay conservative and document the limitation.

4. **React hook surface growth**
   Adding methods without clarifying preferred usage could create confusion.
   Documentation and naming need to keep `updateById` as the default path.

## Done When

The work is complete when:

1. model authors can opt into `toPartialPersisted`
2. adapter consumers can perform full domain writes and partial domain updates
   without hand-building persisted objects
3. React consumers can do the same through `useFirestoreMutations`
4. existing read APIs and existing write callers continue to compile
5. tests and build pass
