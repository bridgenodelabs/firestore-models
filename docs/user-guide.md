# firestore-models User Guide

This guide explains how to use the currently implemented library with versioned persisted shapes, timestamp normalization, and the shipped Firebase adapters.

## 1) Concepts: Domain vs Persisted

- **Domain object**: the application-facing shape your code works with in memory.
- **Persisted object**: the Firestore document data shape, which always includes `schemaVersion`.
- **Document ID**: Firestore document IDs live outside the persisted payload. Compose `snapshot.id` with the hydrated domain object when needed.

Example shapes:

```ts
import type { PersistedBase } from "@bridgenodelabs/firestore-models/core";
import type { TimestampLike } from "@bridgenodelabs/firestore-models/time";

export interface Task {
  title: string;
  done: boolean;
  dueAt?: Date;
  priority: "low" | "medium" | "high";
}

export interface TaskDocumentV1 extends PersistedBase {
  schemaVersion: 1;
  title: string;
  done: boolean;
  dueAt?: TimestampLike;
  priority: "low" | "medium" | "high";
}
```

## 2) Define a model

Use `defineModel` with conversion logic, current schema version, migrations, and an optional validation hook.

```ts
import {
  assertNumber,
  assertObject,
  createValidator,
  defineModel,
  type PersistedBase,
} from "@bridgenodelabs/firestore-models/core";
import {
  dateFromTimestamp,
  timestampFromDate,
  type TimestampLike,
} from "@bridgenodelabs/firestore-models/time";

type TaskPriority = "low" | "medium" | "high";

interface Task {
  title: string;
  done: boolean;
  dueAt?: Date;
  priority: TaskPriority;
}

interface TaskDocumentV0 extends PersistedBase {
  schemaVersion: 0;
  title: string;
  completed: boolean;
  dueDate?: TimestampLike;
}

interface TaskDocumentV1 extends PersistedBase {
  schemaVersion: 1;
  title: string;
  done: boolean;
  dueAt?: TimestampLike;
  priority: TaskPriority;
}

const validateTask = createValidator<TaskDocumentV0 | TaskDocumentV1>(
  (value) => {
    assertObject(value, "Task document must be an object");
    assertNumber(
      value.schemaVersion,
      "Task document schemaVersion must be numeric",
    );

    if (typeof value.title !== "string") {
      throw new Error("Task document title must be a string");
    }

    if (value.schemaVersion === 0 && typeof value.completed !== "boolean") {
      throw new Error("Task v0 document must include completed: boolean");
    }

    if (value.schemaVersion === 1 && typeof value.done !== "boolean") {
      throw new Error("Task v1 document must include done: boolean");
    }
  },
);

const taskModel = defineModel<Task, TaskDocumentV1>({
  currentVersion: 1,
  validatePersisted: validateTask,
  migrations: {
    0: (doc: TaskDocumentV0): TaskDocumentV1 => ({
      schemaVersion: 1,
      title: doc.title,
      done: doc.completed,
      dueAt: doc.dueDate,
      priority: "medium",
    }),
  },
  toPersisted: (task, toTimestamp) => ({
    schemaVersion: 1,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt
      ? timestampFromDate(
          task.dueAt,
          toTimestamp ??
            ((date) => ({
              seconds: Math.floor(date.getTime() / 1000),
              nanoseconds: 0,
            })),
        )
      : undefined,
    priority: task.priority,
  }),
  fromPersisted: (doc) => ({
    title: doc.title,
    done: doc.done,
    dueAt: doc.dueAt ? dateFromTimestamp(doc.dueAt) : undefined,
    priority: doc.priority,
  }),
});
```

For a reusable implementation of this model, see `samples/shared/src/models/task.ts`.

## 3) Migration-on-read behavior

When `readDomain(raw, model)` runs:

1. Optional `validatePersisted(raw)` executes.
2. `schemaVersion` is validated.
3. Migrations are applied from old version to the current version.
4. `fromPersisted` maps the latest persisted shape into the domain shape.

If any migration step is missing, the read throws.

## 4) Timestamp utilities and write-boundary conversion

`dateFromTimestamp` supports:

- native `Date`
- duck-typed `toDate()` objects
- `{ seconds, nanoseconds }`
- `{ _seconds, _nanoseconds }`

`timestampFromDate` delegates timestamp creation to a caller-provided factory.

Use the `toTimestamp` argument to `toPersisted` when writing data with a real Firestore SDK:

```ts
import { Timestamp } from "firebase/firestore";

const persisted = taskModel.toPersisted(
  {
    title: "Ship sample",
    done: false,
    dueAt: new Date(),
    priority: "high",
  },
  Timestamp.fromDate,
);
```

## 5) Reading from Firestore snapshots

Both Firebase adapters are implemented and ship with the library.

### Web SDK

```ts
import { doc, getDoc } from "firebase/firestore";
import { readDocumentDomain } from "@bridgenodelabs/firestore-models/adapters/firebase-client";

const snapshot = await getDoc(doc(db, "tasks/task-1"));
const task = readDocumentDomain(snapshot, taskModel);

const taskWithId = {
  id: snapshot.id,
  ...task,
};
```

### Admin SDK

```ts
import { getFirestore } from "firebase-admin/firestore";
import { readDocumentDomain } from "@bridgenodelabs/firestore-models/adapters/firebase-admin";

const snapshot = await getFirestore().doc("tasks/task-1").get();
const task = readDocumentDomain(snapshot, taskModel);

const taskWithId = {
  id: snapshot.id,
  ...task,
};
```

If you only want structural typing helpers, the adapters also export `toTypedSnapshot` and `toTypedQuerySnapshot`.

## 5.5) Writing to Firestore

The write path now has three explicit lanes:

- full domain write: convert with `model.toPersisted(...)`
- partial domain update: convert with `model.toPartialPersisted(...)`
- raw persisted write/update: pass persisted data directly on purpose

### Adapter helpers

Both Firebase adapters expose matching write helpers:

- `createDocumentDomain(ref, domain, model, options?)`
- `setDocumentDomain(ref, domain, model, options?)`
- `updateDocumentDomain(ref, patch, model, options?)`
- `updateDocumentPersisted(ref, patch)`

Example:

```ts
import {
  createDocumentDomain,
  setDocumentDomain,
  updateDocumentDomain,
  updateDocumentPersisted,
} from "@bridgenodelabs/firestore-models/adapters/firebase-client";
import { Timestamp } from "firebase/firestore";

await createDocumentDomain(taskRef, task, taskModel, {
  toTimestamp: Timestamp.fromDate,
});

await setDocumentDomain(taskRef, task, taskModel, {
  toTimestamp: Timestamp.fromDate,
  merge: true,
});

await updateDocumentDomain(
  taskRef,
  { dueAt: new Date(), priority: "high" },
  taskModel,
  { toTimestamp: Timestamp.fromDate },
);

await updateDocumentPersisted(taskRef, {
  priority: "low",
});
```

### Partial domain updates require `toPartialPersisted`

`updateDocumentDomain(...)` and the React `updateById(...)` helper need a model-owned partial conversion.

```ts
const taskModel = defineModel<Task, TaskDocumentV1>({
  currentVersion: 1,
  toPersisted: (task, toTimestamp) => ({
    schemaVersion: 1,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt ? toTimestamp?.(task.dueAt) : undefined,
    priority: task.priority,
  }),
  toPartialPersisted: (patch, toTimestamp) => ({
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.done !== undefined ? { done: patch.done } : {}),
    ...(patch.dueAt !== undefined
      ? { dueAt: patch.dueAt ? toTimestamp?.(patch.dueAt) : patch.dueAt }
      : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
  }),
  fromPersisted: (doc) => ({
    title: doc.title,
    done: doc.done,
    dueAt: doc.dueAt ? dateFromTimestamp(doc.dueAt) : undefined,
    priority: doc.priority,
  }),
});
```

Without `toPartialPersisted`, partial domain updates throw a descriptive error and callers should use a raw persisted update helper instead.

Keep `toPartialPersisted` shallow. It should only convert fields that are present
in the patch, and it should not imply deep patch or dotted-path semantics.

## 6) Optional React hooks subpath

If your app uses React and the Firebase Web SDK, you can opt into `@bridgenodelabs/firestore-models/react` for subscription and mutation hooks that reuse the same model migration/validation flow.

Small Task example:

```ts
import { query } from "firebase/firestore";
import {
  useFirestoreCollectionDomain,
  useFirestoreMutations,
} from "@bridgenodelabs/firestore-models/react";

type TaskWithId = Task & { id: string };

export function useTasks() {
  const source = tasksCollection ? query(tasksCollection) : null;

  const { documents, loading, error } = useFirestoreCollectionDomain<
    Task,
    TaskDocumentV1,
    TaskWithId
  >({
    source,
    model: taskModel,
    mapDocument: ({ id, domain }) => ({ id, ...domain }),
  });

  const { create, updateById, deleteById } = useFirestoreMutations({
    collection: tasksCollection,
    model: taskModel,
  });

  return {
    tasks: documents,
    loading,
    error,
    createTask: (title: string, priority: TaskPriority) =>
      create({ title, done: false, priority }),
    toggleTask: (task: TaskWithId) =>
      updateById(task.id, { done: !task.done }),
    deleteTask: (id: string) => deleteById(id),
  };
}
```

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

const {
  create,
  updateById,
  setPersistedById,
  updatePersistedById,
  deleteById,
  pending,
  actionDocumentId,
  error: mutationError,
} = useFirestoreMutations({
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
await setPersistedById("task-1", {
  schemaVersion: 1,
  title: "Ship docs",
  done: true,
  priority: "high",
});
await updatePersistedById("task-1", { done: true });
await deleteById("task-1");
```

What these hooks do:

- read hooks call `readDocumentDomain`, so migrations still run on reads
- write hook calls `model.toPersisted(domain, Timestamp.fromDate)` before writes
- `updateById` calls `model.toPartialPersisted(patch, Timestamp.fromDate)` for partial domain updates
- `setPersistedById` and `updatePersistedById` are explicit raw persisted escape hatches
- undefined persisted fields are stripped by default before write operations

Migration note for existing React apps:

- if you currently call `readDocumentDomain` manually in `onSnapshot`, move that logic into `useFirestoreCollectionDomain` or `useFirestoreDocumentDomain`
- if you currently call `model.toPersisted(..., Timestamp.fromDate)` directly before `addDoc`/`setDoc`, move that path into `useFirestoreMutations`
- `@bridgenodelabs/firestore-models/react` is optional and remains isolated from `@bridgenodelabs/firestore-models/core`, `@bridgenodelabs/firestore-models/time`, and adapter subpaths

## 7) Samples

The sample work is now centered on a shared Task model package:

- `samples/shared/`: reusable Task model, persisted shapes, migration, full-write conversion, and shallow partial-update conversion.
- `samples/web-app/`: runnable React + Vite example using the Firebase Web SDK and `@bridgenodelabs/firestore-models/react` hooks, with `create(...)` as the preferred full-write path and `updateById(...)` as the preferred partial-update path.
- `samples/project-task-sample/`: CLI runner that demonstrates model-owned full-write conversion for a `Project` document and its `tasks` subcollection inside a single transaction while reusing the shared `taskModel`.
- `samples/firebase-function/`: planned runnable admin-side example for Cloud Functions and the emulator.

Start with `samples/shared`, then run `samples/web-app` to see domain-driven create/read/update/delete flows against the Firestore emulator. Use raw persisted helpers only as explicit escape hatches.

## 8) Remaining work

The core library is implemented and the Firebase adapters ship today. The main remaining work is around ergonomics and examples:

- stronger migration typing for per-version chains
- a defensive helper for non-advancing migrations
- complete the firebase-admin runnable sample app
- a dedicated API reference document
