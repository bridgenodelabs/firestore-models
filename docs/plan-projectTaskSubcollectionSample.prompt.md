## Plan: Project Task Subcollection Sample

A new standalone sample that layers `Project` domain logic over the existing `taskModel`, demonstrates Firestore subcollection usage, and saves both the parent project and its task documents inside a single `runTransaction` so writes never leave a half-saved state.

**Steps**

1. Scaffold `samples/project-task-sample/` with `package.json`, `tsconfig.json`, and README that mirrors the emulator/run instructions from `samples/web-app`, so contributors can install dependencies, run the emulator, and exercise the new flow without touching the React UI.
2. Add `src/models/project.ts` that defines the `Project` domain document, persisted shape with `schemaVersion`, and `projectModel` via `defineModel`; reuse `dateFromTimestamp`/`timestampFromDate` helpers for timestamp fields and keep migrations/validation simple (current version 1).
3. Create a Firebase helper (`src/lib/firestore.ts`) that boots the emulator-aware Firestore client just like `samples/web-app/src/lib/firestore.ts`, exports `db`, and exposes helper factories for `projects` collection and task subcollections (e.g., `collection(db, "projects", projectId, "tasks")`).
4. Build `src/lib/projectAdapter.ts` around the shared `taskModel`: implement `persistProjectWithTasks(project, tasks)` that uses `runTransaction` to write the project document plus every subcollection task (converting tasks via `taskModel.toPersisted` with `Timestamp.fromDate`), and `getProjectWithTasks(projectId)` that reads the project doc plus the tasks subcollection and hydrates each snapshot with `readDocumentDomain`.
5. Wire a simple runnable entry point (`src/index.ts`) that exercises the adapter: creates a sample project with multiple tasks, runs the transaction, reads everything back, and logs the hydrated `Project & tasks` object. Add `start`/`dev` scripts so `pnpm --dir samples/project-task-sample dev` or `npm run start` replays the flow and provides console proof of the transaction.
6. Document the new sample in `samples/README.md` (list it with a short description) and update `docs/user-guide.md` or another relevant doc to mention the new project/task story as a reference for using subcollections + transactions.

**Relevant files**

- `/samples/shared/src/models/task.ts` — reuse this model definition (validator, migrations, `taskModel`) when coercing each subcollection document into/from Firestore.
- `/samples/web-app/src/lib/firestore.ts` — mirror emulator setup, environment checks, and exported `db`/collection helpers so the new sample stays consistent with the existing Firebase conventions.
- `/samples/web-app/src/lib/taskAdapter.ts` — follow this adapter pattern for `readDocumentDomain`/`toPersisted` usage and for the `ToTimestamp` handling when persisting timestamps.
- `/docs/user-guide.md` or `/samples/README.md` — mention the new sample so the guide buyers know there is a subcollection+transaction demo.

**Verification**

1. Run the new sample (`pnpm --dir samples/project-task-sample dev` or `pnpm --dir samples/project-task-sample start`) while connected to the Firestore emulator (`pnpm --dir samples/web-app start:emulator` or equivalent) and confirm the console logs show the project/task object that was written and read via the transaction.
2. Inspect the emulator data (`firestore emulator UI` or exported JSON if available) to ensure both the project document and its tasks subcollection exist with `schemaVersion: 1` and that no partial writes occur when you intentionally throw inside the transaction.
3. Run `pnpm test` at the repo root if you add unit tests for the adapter (optional) to keep the shared validation/migration logic covered.

**Decisions**

- Keep the new sample isolated so it does not interfere with the existing React web app; this keeps focus on the Firestore subcollection+transaction behavior.
- Use a simple runnable script/CLI instead of a full UI because the goal is to show the transactional pattern rather than user interaction complexity.
- Transaction writes only touch the project document and its tasks subcollection; any additional cascades (e.g., storing analytics logs) are out of scope for this sample.

**Further Considerations**

1. The new sample could later be wrapped in a minimal UI or surfaced via an HTTP function once the Firebase Admin adapter sample is fleshed out, but start with the simple TypeScript runner for clarity.
2. Consider adding tests that mock `runTransaction` to ensure the adapter aborts when any task write would fail, which also documents how to throw inside the transaction for rollback behavior.
