# firestore-type Samples

Sample applications demonstrating `firestore-type` patterns including migration-on-read, domain/persisted separation, and adapter-based Firestore integration.

## Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js** 20 or later
- **pnpm** (npm package manager)
- **Firebase Emulator Suite** (`firebase-tools`)

#### Install Firebase Emulator Suite

```bash
npm install -g firebase-tools
```

Verify installation:

```bash
firebase --version
```

### One-time Setup

From the repository root:

```bash
# Install root dependencies
pnpm install

# Build the firestore-type library
pnpm build
```

## Available Samples

### Web App (React + Vite)

A complete, runnable React application demonstrating Firestore integration using the Firebase Web SDK.

**Features:**

- Live task list with Firestore subscriptions
- Create, read (with live updates), toggle done, and delete tasks
- Migration-on-read: transparent upgrade of `schemaVersion: 0` documents to current domain shape
- Domain/persisted boundary isolation via `firestore-type/react` hooks
- Emulator-first development flow

**Getting started:**

```bash
cd samples/web-app
pnpm install
pnpm dev
```

See [samples/web-app/README.md](web-app/README.md) for:

- Detailed Firebase Emulator setup and environment variables
- Running the app and testing CRUD operations
- Seeding legacy schemaVersion 0 documents
- Running automated verification (`pnpm verify:live`)

### Project Task Subcollection Runner

A focused CLI sample that layers a `Project` model on top of the shared `Task` model and writes both a parent document and its task subcollection inside the same `runTransaction`.

**Features:**

- Persisting `projects/{projectId}` and every `projects/{projectId}/tasks/{taskId}` document together so any failure rolls back the entire batch
- Rehydrating the project and nested task array from Firestore via `readDocumentDomain`, including schema/migration logic
- Illustrating how to reuse `taskModel` for subcollection writes while keeping the project document separate

**Getting started:**

```bash
cd samples/project-task-sample
pnpm install
pnpm dev
```

See [samples/project-task-sample/README.md](project-task-sample/README.md) for environment variables, emulator setup, and verification tips.

### Firebase Function (Cloud Function Adapter)

Sample Cloud Function implementation using `firestore-type/adapters/firebase-admin` for server-side migrations and mutations.

**Status:** Coming soon

**Planned scope:**

- HTTP-triggered Cloud Function for task creation
- Admin SDK integration with migration middleware
- Firestore Trigger Function for audit logging
- Emulator-compatible setup

## Quick Reference: Firebase Emulator Configuration

All samples use the Firebase Emulator Suite locally for safe, fast development. Default emulator settings:

- **Host:** `127.0.0.1`
- **Firestore Port:** `8080`
- **Emulator UI Port:** `4000`

### Start the Emulator

From any directory with a valid `firebase.json`:

```bash
firebase emulators:start --only firestore
```

### Access the Emulator UI

Open [http://127.0.0.1:4000](http://127.0.0.1:4000) in your browser to inspect Firestore data, add/edit documents, or clear the database between test runs.

### Clear Firestore Data

Via Emulator UI:

1. Select **Firestore Database** tab
2. Click the trash icon to clear all data

Or restart the emulator process.

## Samples Project Structure

```
samples/
├── shared/                          # Shared models and utilities
│   ├── src/
│   │   └── models/
│   │       └── task.ts              # Task domain model, migration logic, validation
│   └── package.json
├── web-app/                         # React + Vite sample (runnable)
│   ├── src/
│   │   ├── lib/                     # Firestore init and SDK configuration
│   │   ├── hooks/                   # Composition over firestore-type/react hooks
│   │   ├── components/              # UI components
│   │   └── styles/                  # CSS design system
│   ├── scripts/
│   │   └── liveVerification.ts      # CRUD + migration verification script
│   ├── package.json
│   └── README.md
└── firebase-function/               # Cloud Function sample (stub)
    └── Coming soon...
```

## Common Tasks

### Run Web Sample

```bash
# Terminal 1: Start emulator
firebase emulators:start --only firestore

# Terminal 2: Run dev server
cd samples/web-app
pnpm dev
```

### Verify Web Sample (Automated)

```bash
cd samples/web-app
pnpm verify:live
```

This runs a TypeScript script that tests:

- Creating a current-version (schemaVersion 1) task
- Reading tasks with live updates through the React hook path
- Seeding and reading a legacy (schemaVersion 0) document
- Transparent migration to the current domain shape
- Toggling and deleting tasks

### Test Against Emulator

All samples connect automatically to the emulator in development mode. The web sample reads and writes through `firestore-type/react`, which still uses `readDocumentDomain` and model migration logic under the hood.

## Documentation

- [firestore-type User Guide](../docs/user-guide.md) — High-level library overview
- [Migration Philosophy](../docs/migration-philosophy.md) — Design rationale for migration-on-read patterns
- [Web App README](web-app/README.md) — Detailed web sample setup and flow documentation

## Next Steps

- Follow the [Web App Quick Start](#web-app-react--vite) to run a complete example
- Review [Web App README](web-app/README.md) for configuration and verification details
- Explore the [shared Task model](shared/src/models/task.ts) to understand domain/persisted separation
- Check the root [docs/](../docs/) folder for design and philosophy documentation
