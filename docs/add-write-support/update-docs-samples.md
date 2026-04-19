# Update Docs and Samples for Write Support

Status: implemented on the current branch.

## Objective

Update the repository documentation and the two runnable samples so they use
and demonstrate the new write-support APIs introduced for
`@bridgenodelabs/firestore-models`.

The refreshed docs and samples now make the preferred write path obvious:

- full domain writes go through model conversion
- partial domain updates go through `toPartialPersisted`
- raw persisted writes remain available as explicit escape hatches

## Agreed Decisions

1. The web sample should demonstrate the preferred path:
   - `create(...)` for full domain writes
   - `updateById(...)` for partial domain updates
2. The project/task sample should demonstrate adapter-style domain writes where
   that fits naturally.
3. The shared `Task` model should add `toPartialPersisted`.
4. The `Project` model should remain full-write only unless a real partial
   update use case appears.

## Scope

This plan covers:

- root docs and sample docs that still describe older write usage
- `samples/shared` model updates needed to support domain-driven partial updates
- `samples/web-app` updates to use the new React mutation API
- `samples/project-task-sample` updates to align with the new write model

This plan does not cover:

- additional library API expansion for transaction-specific writes
- deep partial update semantics
- new sample apps

## What Changed

### 1. Shared Task model

Files:

- [samples/shared/src/models/task.ts](/Users/toddwseattle/dev/firestore-models/samples/shared/src/models/task.ts)
- [samples/shared/README.md](/Users/toddwseattle/dev/firestore-models/samples/shared/README.md)

Implemented:

1. Added `toPartialPersisted` to `taskModel`.
2. Kept the conversion shallow and aligned with the write spec.
3. Reused the existing timestamp conversion behavior for `dueAt`.
4. Updated the shared sample README to call out:
   - full domain writes via `toPersisted`
   - partial domain updates via `toPartialPersisted`
   - `TimestampLike` only at the persisted boundary

Result:

- `Task` now supports the preferred partial domain update path.
- `toPartialPersisted` only emits fields that are actually present in the patch,
  which keeps Firestore `update` calls valid.

### 2. Web sample

Files:

- [samples/web-app/src/hooks/useTaskList.ts](/Users/toddwseattle/dev/firestore-models/samples/web-app/src/hooks/useTaskList.ts)
- [samples/web-app/scripts/liveVerification.ts](/Users/toddwseattle/dev/firestore-models/samples/web-app/scripts/liveVerification.ts)
- [samples/web-app/README.md](/Users/toddwseattle/dev/firestore-models/samples/web-app/README.md)

Implemented:

1. Replaced `updatePersistedById(...)` with `updateById(...)` in the hook layer.
2. Kept `create(...)` as the full domain write path.
3. Updated the live verification script so it demonstrates:
   - full write through model-driven conversion
   - partial update through the domain-driven path
4. Rewrote README examples and verification language so the sample clearly
   demonstrates:
   - domain-driven create
   - domain-driven partial update
   - migration-on-read remains unchanged
5. Kept raw persisted writes out of the main sample workflow.

Notes:

- The verification script uses a small writer adapter around a Web SDK
  `DocumentReference` so it can exercise `updateDocumentDomain(...)` directly
  without changing the adapter API shape.

### 3. Project/task sample

Files:

- [samples/project-task-sample/src/lib/projectAdapter.ts](/Users/toddwseattle/dev/firestore-models/samples/project-task-sample/src/lib/projectAdapter.ts)
- [samples/project-task-sample/README.md](/Users/toddwseattle/dev/firestore-models/samples/project-task-sample/README.md)

Implemented:

1. Replaced ad hoc write descriptions with language centered on domain-driven
   writes.
2. Kept the code on the natural transaction boundary by converting `Project`
   and `Task` domain objects before `transaction.set(...)`.
3. Kept the transaction sample honest about its boundary:
   - it prepares persisted payloads for transaction writes
   - it does not force adapter helper names into transaction code
4. Updated the README to explain that this sample demonstrates:
   - model-owned conversion for full writes
   - atomic transaction orchestration
   - read hydration through `readDocumentDomain`

### 4. Top-level docs and sample index docs

Files:

- [README.md](/Users/toddwseattle/dev/firestore-models/README.md)
- [samples/README.md](/Users/toddwseattle/dev/firestore-models/samples/README.md)
- [docs/user-guide.md](/Users/toddwseattle/dev/firestore-models/docs/user-guide.md) if follow-up cleanup was still needed
- [docs/design.md](/Users/toddwseattle/dev/firestore-models/docs/design.md) if summary language still lagged implementation

Implemented:

1. Replaced the older default React example in `README.md` with `updateById(...)`
   for the common path.
2. Added concise guidance around the three write lanes:
   - full domain write
   - partial domain update
   - raw persisted escape hatch
3. Kept compatibility APIs documented, but secondary.
4. Left `docs/user-guide.md` and `docs/design.md` unchanged because the sample
   and README refresh resolved the practical drift without needing a second docs
   pass.

### 5. Verification

Commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm --dir samples/web-app verify:live
pnpm --dir samples/project-task-sample typecheck
pnpm --dir samples/project-task-sample dev
```

Completed:

1. `pnpm lint`
2. `pnpm test`
3. `pnpm build`
4. `pnpm --dir samples/web-app typecheck`
5. `pnpm --dir samples/web-app verify:live`
6. `pnpm --dir samples/project-task-sample typecheck`
7. `pnpm --dir samples/project-task-sample dev`

Observed results:

- The web sample performs create/read/update/delete successfully against the
  Firestore emulator.
- The web sample now demonstrates `updateById(...)` as the default partial
  update path.
- The project/task sample still performs atomic parent/subcollection writes and
  rehydrates through `readDocumentDomain`.
- Documentation examples match the actual sample code and public API.

## Notes

1. `Project` remains full-write only. No `toPartialPersisted` was added there.
2. Raw persisted writes remain available and documented as explicit escape
   hatches, but they are no longer the main sample path.
3. No changes were needed in `docs/user-guide.md` or `docs/design.md`.

## Done

Done on this branch:

1. `samples/shared` exposes `toPartialPersisted` for `Task`
2. `samples/web-app` uses `updateById(...)` for its preferred update flow
3. `samples/project-task-sample` documentation reflects the new write model
   without distorting transaction semantics
4. root docs and sample docs consistently describe the new write paths
5. verification passed and the examples match the implementation
