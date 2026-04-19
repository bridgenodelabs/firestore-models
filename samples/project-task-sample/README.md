# Project Task Subcollection Sample

A small TypeScript runner that shows how to layer a `Project` model over the shared `Task` model, persist both the parent document and its task subcollection inside a single Firestore transaction, and then read everything back through `@bridgenodelabs/firestore-models` migration layer.

## What this demonstrates

- Defining a `Project` model with schema-versioned persisted shape and timestamp normalization
- Reusing `samples/shared/src/models/task.ts` for each task document in `projects/{projectId}/tasks`
- Converting full domain objects through model-owned write helpers before transaction writes
- Writing the project document and every task document together via `runTransaction`, preventing partial writes
- Reading the project plus all `Task` subcollection documents through `readDocumentDomain`

## Prerequisites

- Node.js 22+ (for this repository and the Firebase Web SDK in Node)
- `pnpm`
- Firebase Emulator Suite (`firebase-tools`)

## Setup

```bash
pnpm install
pnpm build
cd samples/project-task-sample
pnpm install
```

## Environment

Copy the sample env file and edit the required values:

```bash
cp samples/project-task-sample/.env.local.sample samples/project-task-sample/.env.local
```

Required Firebase config variables (the sample accepts either prefix, and `.env.local.sample` uses the `VITE_FIREBASE_*` form):

- `FIREBASE_API_KEY` or `VITE_FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN` or `VITE_FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID` or `VITE_FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID` or `VITE_FIREBASE_APP_ID`

Optional extras (storage, messaging, measurement) are included in the sample file. The sample also reads:

- `USE_FIREBASE_EMULATOR` (default `true` when running via `dev`)
- `FIREBASE_EMULATOR_HOST`
- `FIREBASE_EMULATOR_PORT`
- `PROJECT_TASKS_PROJECT_ID` (defaults to `project-demo`)

## Running the sample

1. Start the Firestore emulator from any directory containing `firebase.json`:

   ```bash
   firebase emulators:start --only firestore
   ```

2. In a second terminal, run the sample runner:

   ```bash
   pnpm --dir samples/project-task-sample dev
   ```

The script:

- Converts the `Project` and `Task` domain objects to persisted payloads before entering the transaction
- Persists a sample project document plus two task documents in `projects/{projectId}` and `projects/{projectId}/tasks` inside a single transaction
- Reads the project document and every task document back through the adapters, triggering validation/migration if needed
- Logs the fully hydrated `Project` object followed by the `tasks` array so you can verify `schemaVersion: 1` on every document

## Verifying the flow

- Use the Emulator UI (http://127.0.0.1:4000) to inspect `projects` and each subcollection. All documents should contain `schemaVersion: 1`.
- Re-run the script; the transaction reuses the same IDs, so subsequent runs overwrite the existing documents atomically.
- Modify one of the conversion or transaction writes to throw (edit `src/lib/projectAdapter.ts`), rerun, and confirm that neither the project nor any task documents appear in Firestore.

## Next steps

- Replace the runner with your own CLI, HTTP function, or UI and reuse `persistProjectWithTasks`/`getProjectWithTasks` to keep model conversion and transactions consistent.
- Add migrations to `Project` or `Task` models when schema requirements change—the sample shows how each persisted document runs through validation + migrations before hydrating a domain object.
