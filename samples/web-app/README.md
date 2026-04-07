# Web Task Sample

Runnable React + Vite sample that demonstrates `firestore-type` migration-on-read and domain/persisted separation with the Firebase Web SDK.

The UI only works with `Task` domain objects from the shared sample model. Firestore read/write wiring is handled through the optional `firestore-type/react` hooks subpath.

## What this demonstrates

- Create task writes with `schemaVersion: 1` persisted shape
- Live list reads using `useFirestoreCollectionDomain` from `firestore-type/react`
- Legacy `schemaVersion: 0` docs transparently migrate to current `Task` domain objects
- Toggle done and delete via `useFirestoreMutations`
- Emulator-first development flow for safe local testing

## Prerequisites

- Node.js 20+
- `pnpm`
- Firebase Emulator Suite (`firebase-tools`)

## Install

From repository root:

```bash
pnpm build
cd samples/web-app
pnpm install
```

## Environment variables

Start from the checked-in sample file and create your local file:

```bash
cp samples/web-app/.env.local.sample samples/web-app/.env.local
```

Then edit `samples/web-app/.env.local` (this file is gitignored):

```bash
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-project
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456

# Optional extras
VITE_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEFG123

# Emulator settings (defaults shown)
VITE_USE_FIREBASE_EMULATOR=true
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_EMULATOR_PORT=8080
```

`VITE_USE_FIREBASE_EMULATOR` defaults to enabled in dev mode, but setting it explicitly is recommended.

Required variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

If any required value is missing, the app shows a configuration error in the UI with the missing variable names.

## Run with Firebase Emulator Suite

1. Start Firestore emulator in your Firebase project directory:

```bash
firebase emulators:start --only firestore
```

2. In another terminal, run the sample app:

```bash
pnpm --dir samples/web-app dev
```

3. Open the Vite URL and verify create/read/update/delete operations.

4. Run the scripted emulator verification if you want a repeatable CRUD + migration check:

```bash
cd samples/web-app
pnpm verify:live
```

## Seed a legacy v0 task

Insert one document manually in the emulator (via Emulator UI or script) using this shape:

```json
{
  "schemaVersion": 0,
  "title": "Legacy imported task",
  "completed": true,
  "dueDate": {
    "seconds": 1893456000,
    "nanoseconds": 0
  }
}
```

When the app loads, the task appears using the current domain fields (`done`, `dueAt`, `priority`) without any UI branching on legacy fields.

## Verify expected flows

1. Create a task and inspect Firestore data: it should store `schemaVersion: 1` plus `done`, `dueAt`, and `priority`.
2. Add a `schemaVersion: 0` document and refresh: it should render like a normal task.
3. Toggle done state: the document updates through the shared mutation hook.
4. Delete a task: the document is removed and list updates immediately.

## Scripted live verification

`pnpm verify:live` connects to the Firestore emulator, creates a current-version task, validates the raw persisted document, reads it back through `readDocumentDomain`, seeds a legacy `schemaVersion: 0` task, confirms migration to the current domain shape, toggles the current task, and then deletes both verification documents.

The script reads `samples/web-app/.env.local` when present, but also falls back to the demo values shown above so it can run against a local emulator with minimal setup.

## Files of interest

- `.env.local.sample` env template committed to the repo
- `src/lib/firestore.ts` Firebase app setup + emulator connection
- `src/models/task.ts` shared model re-export (no duplicated migration logic)
- `src/hooks/useTaskList.ts` composition layer that uses `firestore-type/react` hooks
- `src/components/TaskForm.tsx` create flow
- `src/components/TaskList.tsx` list/toggle/delete flows
