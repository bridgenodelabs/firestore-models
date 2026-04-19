# firestore-models

TypeScript utilities for defining Firestore-backed models with explicit persisted shapes, schema-versioned migrations, runtime validation hooks, and timestamp normalization.

The library keeps your application-facing domain types separate from the objects you actually store in Firestore.

Repository: https://github.com/bridgenodelabs/firestore-models

Package: `@bridgenodelabs/firestore-models`

## What it does

- Separates domain objects from persisted Firestore documents
- Requires `schemaVersion` on persisted documents
- Migrates older document versions on read
- Supports optional runtime validation before migration/hydration
- Normalizes timestamp-like values without importing Firebase types into core code
- Provides optional adapters for Firebase Web SDK and Firebase Admin SDK
- Provides an optional React hooks subpath for Firebase Web SDK subscriptions and mutations

## Install

Install the library:

```bash
pnpm add @bridgenodelabs/firestore-models
```

If you want to use one of the Firebase adapters, also install the relevant peer dependency:

```bash
pnpm add firebase
```

```bash
pnpm add firebase-admin
```

If you want to use the optional React hooks subpath, install React as well:

```bash
pnpm add react
```

## Using the library

Use the core package to define pure model logic, then choose the adapter that matches the Firestore runtime you use:

- `@bridgenodelabs/firestore-models/core` for model definitions, migrations, read hydration, and validators
- `@bridgenodelabs/firestore-models/time` for SDK-independent timestamp conversion
- `@bridgenodelabs/firestore-models/adapters/firebase-client` for Firebase Web SDK snapshots
- `@bridgenodelabs/firestore-models/adapters/firebase-admin` for Firebase Admin SDK snapshots
- `@bridgenodelabs/firestore-models/react` for optional Firebase Web SDK React subscriptions and mutations

The library does not own your Firestore collection paths, Firebase app initialization, security rules, or write orchestration. It gives you a typed model boundary so application code can work with domain objects while Firestore stores explicit, versioned persisted shapes.

### Core idea

Model definitions work with two shapes:

- `Domain`: the object your application uses in memory
- `Persisted`: the object stored in Firestore, including `schemaVersion`

You define how to convert between them, and the library handles validation and migration-on-read.

### Quick start

This example stores a `Task` with a versioned persisted shape.

```ts
import {
  defineModel,
  readDomain,
  type PersistedBase,
} from "@bridgenodelabs/firestore-models/core";

interface Task {
  title: string;
  done: boolean;
}

interface TaskDocument extends PersistedBase {
  schemaVersion: 1;
  title: string;
  done: boolean;
}

const taskModel = defineModel<Task, TaskDocument>({
  currentVersion: 1,
  toPersisted: (task) => ({
    schemaVersion: 1,
    title: task.title,
    done: task.done,
  }),
  fromPersisted: (doc) => ({
    title: doc.title,
    done: doc.done,
  }),
});

const raw = {
  schemaVersion: 1,
  title: "Ship README",
  done: false,
};

const task = readDomain(raw, taskModel);
// { title: 'Ship README', done: false }
```

### Migration on read

If older documents are still in Firestore, define migrations keyed by the source version.

```ts
import {
  defineModel,
  readDomain,
  type PersistedBase,
} from "@bridgenodelabs/firestore-models/core";

interface Task {
  title: string;
  done: boolean;
}

interface TaskDocumentV0 extends PersistedBase {
  schemaVersion: 0;
  title: string;
}

interface TaskDocumentV1 extends PersistedBase {
  schemaVersion: 1;
  title: string;
  done: boolean;
}

const taskModel = defineModel<Task, TaskDocumentV1>({
  currentVersion: 1,
  toPersisted: (task) => ({
    schemaVersion: 1,
    title: task.title,
    done: task.done,
  }),
  fromPersisted: (doc) => ({
    title: doc.title,
    done: doc.done,
  }),
  migrations: {
    0: (doc: TaskDocumentV0): TaskDocumentV1 => ({
      schemaVersion: 1,
      title: doc.title,
      done: false,
    }),
  },
});

const oldDoc = {
  schemaVersion: 0,
  title: "Imported task",
};

const task = readDomain(oldDoc, taskModel);
// { title: 'Imported task', done: false }
```

The read flow is:

1. Validate the raw value if `validatePersisted` is provided
2. Assert that `schemaVersion` exists and is valid
3. Apply migrations in order until `currentVersion`
4. Convert the latest persisted shape into the domain object

### Validation hook

You can run runtime validation before migration and hydration.

```ts
import {
  assertNumber,
  assertObject,
  createValidator,
  defineModel,
  readDomain,
  type PersistedBase,
} from "@bridgenodelabs/firestore-models/core";

interface Counter {
  value: number;
}

interface CounterDocument extends PersistedBase {
  schemaVersion: 1;
  value: number;
}

const validateCounter = createValidator<CounterDocument>((value) => {
  assertObject(value, "Counter document must be an object");
  assertNumber(value.schemaVersion, "schemaVersion must be a number");
  assertNumber(value.value, "value must be a number");
});

const counterModel = defineModel<Counter, CounterDocument>({
  currentVersion: 1,
  validatePersisted: validateCounter,
  toPersisted: (counter) => ({
    schemaVersion: 1,
    value: counter.value,
  }),
  fromPersisted: (doc) => ({
    value: doc.value,
  }),
});

const counter = readDomain({ schemaVersion: 1, value: 42 }, counterModel);
```

### Timestamps without Firebase imports in core models

The `time` module accepts a duck-typed timestamp shape, so your model definitions do not need to import Firebase SDK types.

```ts
import {
  defineModel,
  type PersistedBase,
  type ToTimestamp,
} from "@bridgenodelabs/firestore-models/core";
import {
  dateFromTimestamp,
  type TimestampLike,
} from "@bridgenodelabs/firestore-models/time";

interface Task {
  title: string;
  createdAt: Date;
}

interface TaskDocument extends PersistedBase {
  schemaVersion: 1;
  title: string;
  createdAt: TimestampLike;
}

const taskModel = defineModel<Task, TaskDocument>({
  currentVersion: 1,
  toPersisted: (task, toTimestamp?: ToTimestamp) => {
    if (!toTimestamp) {
      throw new Error("toTimestamp is required when persisting Task.createdAt");
    }

    return {
      schemaVersion: 1,
      title: task.title,
      createdAt: toTimestamp(task.createdAt),
    };
  },
  fromPersisted: (doc) => ({
    title: doc.title,
    createdAt: dateFromTimestamp(doc.createdAt),
  }),
});
```

At the Firestore boundary, pass the SDK's timestamp factory:

```ts
import { Timestamp } from "firebase/firestore";

const persisted = taskModel.toPersisted(
  { title: "Ship release", createdAt: new Date() },
  Timestamp.fromDate,
);
```

You can also use the helper directly:

```ts
import { timestampFromDate } from "@bridgenodelabs/firestore-models/time";
import { Timestamp } from "firebase/firestore";

const timestamp = timestampFromDate(new Date(), Timestamp.fromDate);
```

### Firebase Web SDK example

Use the Web adapter to read a `DocumentSnapshot` and run the full migration-on-read flow.

```ts
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { readDocumentDomain } from "@bridgenodelabs/firestore-models/adapters/firebase-client";

const snapshot = await getDoc(doc(db, "tasks/task-1"));

const task = readDocumentDomain(snapshot, taskModel);

const persisted = taskModel.toPersisted(
  { title: "Client write", createdAt: new Date() },
  Timestamp.fromDate,
);
```

If you only want typed snapshot wrappers, the adapter also exports `toTypedSnapshot` and `toTypedQuerySnapshot`.

### Firebase Admin SDK example

Use the Admin adapter the same way on the server.

```ts
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readDocumentDomain } from "@bridgenodelabs/firestore-models/adapters/firebase-admin";

const snapshot = await getFirestore().doc("tasks/task-1").get();

const task = readDocumentDomain(snapshot, taskModel);

const persisted = taskModel.toPersisted(
  { title: "Server write", createdAt: new Date() },
  Timestamp.fromDate,
);
```

### Optional React hooks example

Use the optional `@bridgenodelabs/firestore-models/react` subpath to compose migration-on-read and model-aware writes in client apps.

```ts
import { query } from "firebase/firestore";
import {
  useFirestoreCollectionDomain,
  useFirestoreMutations,
} from "@bridgenodelabs/firestore-models/react";

const {
  documents: tasks,
  loading,
  error,
} = useFirestoreCollectionDomain({
  source: query(tasksCollection),
  model: taskModel,
});

const { create, updateById, deleteById } = useFirestoreMutations({
  collection: tasksCollection,
  model: taskModel,
});

await create({
  title: "Ship docs",
  done: false,
  dueAt: new Date(),
  priority: "high",
});

await updateById("task-1", { done: true });
await deleteById("task-1");
```

Preferred write lanes:

- full domain writes: `create(...)`, `setDocumentDomain(...)`, or `model.toPersisted(...)`
- partial domain updates: `updateById(...)` or `updateDocumentDomain(...)` with `toPartialPersisted(...)`
- raw persisted escape hatches: `setPersistedById(...)`, `updatePersistedById(...)`, or persisted adapter helpers when you intentionally want Firestore-shaped data

## Main exports

Top-level package:

```ts
import { core, time, getDocumentData } from "@bridgenodelabs/firestore-models";
```

Focused subpath imports:

```ts
import { defineModel, readDomain } from "@bridgenodelabs/firestore-models/core";
import {
  dateFromTimestamp,
  timestampFromDate,
} from "@bridgenodelabs/firestore-models/time";
import { readDocumentDomain } from "@bridgenodelabs/firestore-models/adapters/firebase-client";
import { readDocumentDomain as readAdminDocumentDomain } from "@bridgenodelabs/firestore-models/adapters/firebase-admin";
import {
  useFirestoreCollectionDomain,
  useFirestoreMutations,
} from "@bridgenodelabs/firestore-models/react";
```

## Claude Code agents

The package ships two [Claude Code](https://claude.ai/code) subagent definitions in the `agents/` directory. Once installed they automate the most repetitive parts of adopting the library.

| File                                   | What it does                                                                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents/persistInterfaceToFirebase.md` | Give it a TypeScript interface and it scaffolds the full `@bridgenodelabs/firestore-models` model: persisted type, validator, `defineModel` with `toPersisted`/`fromPersisted`, and a Firebase Web SDK usage snippet                |
| `agents/createFirestoreHooks.md`       | Give it an existing model and collection reference and it generates typed React hooks (`use<Name>List`, `use<Name>Document`) that compose `useFirestoreCollectionDomain`, `useFirestoreDocumentDomain`, and `useFirestoreMutations` |

### Using the agents

Copy the agent files you want into your project's `.claude/agents/` directory:

```bash
mkdir -p .claude/agents
cp node_modules/@bridgenodelabs/firestore-models/agents/persistInterfaceToFirebase.md .claude/agents/
cp node_modules/@bridgenodelabs/firestore-models/agents/createFirestoreHooks.md .claude/agents/
```

Claude Code picks up any `.md` files in `.claude/agents/` automatically. The agents will then appear when Claude decides the task matches their description, or you can invoke them explicitly:

```
Use the persistInterfaceToFirebase agent to scaffold a model for this interface:

interface Product {
  name: string;
  price: number;
  createdAt: Date;
}
```

```
Use the createFirestoreHooks agent to generate React hooks for productModel
using the productsCollection reference in src/lib/firestore.ts.
```

## Quality gates

This repository includes local and remote quality gates so publishable changes are checked before they land.

### Pre-commit hooks

Husky is configured through the `prepare` script and installs two hooks:

- `pre-commit`: runs `pnpm run lint && pnpm run typecheck`
- `pre-push`: runs `pnpm run test && pnpm run build`

That means type errors are blocked before commit, and tests plus package build are blocked before push.

### CI and publish automation

GitHub Actions adds the same checks in automation:

- CI runs on pull requests and pushes to `main`
- CI runs `lint`, `typecheck`, `test`, `build`, and `npm pack --dry-run`
- Publish runs on version tags like `v0.1.0`
- Publish re-runs verification before `npm publish --access public --provenance`

The publish workflow is intended for the repository at `bridgenodelabs/firestore-models`.

## Creating a pull request

Use Node.js 22 or later and pnpm 9 or later. From a fresh checkout:

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run pack:check
```

Before opening a PR:

1. Keep changes scoped to the model, adapter, sample, or documentation behavior being changed.
2. Add or update tests when changing runtime behavior.
3. Update README, `docs/user-guide.md`, or sample READMEs when public usage changes.
4. Run the checks above locally. CI runs the same lint, typecheck, test, build, and package-content checks on pull requests.
5. For sample changes, run the affected sample command as well, such as `pnpm --dir samples/shared run check`, `pnpm --dir samples/web-app typecheck`, or `pnpm --dir samples/project-task-sample typecheck`.

PRs should describe the user-visible behavior change, the verification performed, and any follow-up work intentionally left out.

## Development

```bash
pnpm install
pnpm test
pnpm build
```

See `docs/user-guide.md` for the longer usage guide and `docs/firestore-object-toolkit-design.md` for the design overview.

Sample projects:

- `samples/shared`: shared Task model with migration, full-write conversion, and partial-update conversion
- `samples/web-app`: runnable React + Vite Firebase Emulator sample using `create(...)` for full domain writes and `updateById(...)` for partial domain updates
- `samples/project-task-sample`: CLI runner demonstrating model-owned conversion plus transactional writes to a nested `projects/{projectId}/tasks` subcollection

Documentation note: several files under `docs/` are historical planning or design-capture artifacts rather than current user guides. Keep `README.md`, `docs/user-guide.md`, and the sample READMEs as the primary documentation surface.
