# Firestore-type User Guide

This guide explains how to use the currently implemented library with versioned persisted shapes, timestamp normalization, and the shipped Firebase adapters.

## 1) Concepts: Domain vs Persisted

- **Domain object**: the application-facing shape your code works with in memory.
- **Persisted object**: the Firestore document data shape, which always includes `schemaVersion`.
- **Document ID**: Firestore document IDs live outside the persisted payload. Compose `snapshot.id` with the hydrated domain object when needed.

Example shapes:

```ts
import type { PersistedBase } from "firestore-type/core";
import type { TimestampLike } from "firestore-type/time";

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
} from "firestore-type/core";
import {
  dateFromTimestamp,
  timestampFromDate,
  type TimestampLike,
} from "firestore-type/time";

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
import { readDocumentDomain } from "firestore-type/adapters/firebase-client";

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
import { readDocumentDomain } from "firestore-type/adapters/firebase-admin";

const snapshot = await getFirestore().doc("tasks/task-1").get();
const task = readDocumentDomain(snapshot, taskModel);

const taskWithId = {
  id: snapshot.id,
  ...task,
};
```

If you only want structural typing helpers, the adapters also export `toTypedSnapshot` and `toTypedQuerySnapshot`.

## 6) Samples

The sample work is now centered on a shared Task model package:

- `samples/shared/`: reusable Task model, persisted shapes, migration, and timestamp helpers.
- `samples/web-app/`: planned runnable React + Vite example using the Firebase Web SDK.
- `samples/firebase-function/`: planned runnable admin-side example for Cloud Functions and the emulator.

Start with `samples/shared` if you want the clearest end-to-end example of the library contract.

## 7) Remaining work

The core library is implemented and the Firebase adapters ship today. The main remaining work is around ergonomics and examples:

- stronger migration typing for per-version chains
- a defensive helper for non-advancing migrations
- runnable end-to-end sample apps for the emulator
- a dedicated API reference document
