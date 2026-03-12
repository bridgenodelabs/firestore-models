# firestore-type

TypeScript utilities for defining Firestore-backed models with explicit persisted shapes, schema-versioned migrations, runtime validation hooks, and timestamp normalization.

The library keeps your application-facing domain types separate from the objects you actually store in Firestore.

## What it does

- Separates domain objects from persisted Firestore documents
- Requires `schemaVersion` on persisted documents
- Migrates older document versions on read
- Supports optional runtime validation before migration/hydration
- Normalizes timestamp-like values without importing Firebase types into core code
- Provides optional adapters for Firebase Web SDK and Firebase Admin SDK

## Install

Install the library:

```bash
pnpm add firestore-type
```

If you want to use one of the Firebase adapters, also install the relevant peer dependency:

```bash
pnpm add firebase
```

```bash
pnpm add firebase-admin
```

## Core idea

Model definitions work with two shapes:

- `Domain`: the object your application uses in memory
- `Persisted`: the object stored in Firestore, including `schemaVersion`

You define how to convert between them, and the library handles validation and migration-on-read.

## Quick start

This example stores a `Task` with a versioned persisted shape.

```ts
import {
  defineModel,
  readDomain,
  type PersistedBase,
} from "firestore-type/core";

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

## Migration on read

If older documents are still in Firestore, define migrations keyed by the source version.

```ts
import {
  defineModel,
  readDomain,
  type PersistedBase,
} from "firestore-type/core";

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

## Validation hook

You can run runtime validation before migration and hydration.

```ts
import {
  assertNumber,
  assertObject,
  createValidator,
  defineModel,
  readDomain,
  type PersistedBase,
} from "firestore-type/core";

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

## Timestamps without Firebase imports in core models

The `time` module accepts a duck-typed timestamp shape, so your model definitions do not need to import Firebase SDK types.

```ts
import {
  defineModel,
  type PersistedBase,
  type ToTimestamp,
} from "firestore-type/core";
import { dateFromTimestamp, type TimestampLike } from "firestore-type/time";

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
import { timestampFromDate } from "firestore-type/time";
import { Timestamp } from "firebase/firestore";

const timestamp = timestampFromDate(new Date(), Timestamp.fromDate);
```

## Firebase Web SDK example

Use the Web adapter to read a `DocumentSnapshot` and run the full migration-on-read flow.

```ts
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { readDocumentDomain } from "firestore-type/adapters/firebase-client";

const snapshot = await getDoc(doc(db, "tasks/task-1"));

const task = readDocumentDomain(snapshot, taskModel);

const persisted = taskModel.toPersisted(
  { title: "Client write", createdAt: new Date() },
  Timestamp.fromDate,
);
```

If you only want typed snapshot wrappers, the adapter also exports `toTypedSnapshot` and `toTypedQuerySnapshot`.

## Firebase Admin SDK example

Use the Admin adapter the same way on the server.

```ts
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readDocumentDomain } from "firestore-type/adapters/firebase-admin";

const snapshot = await getFirestore().doc("tasks/task-1").get();

const task = readDocumentDomain(snapshot, taskModel);

const persisted = taskModel.toPersisted(
  { title: "Server write", createdAt: new Date() },
  Timestamp.fromDate,
);
```

## Main exports

Top-level package:

```ts
import { core, time, getDocumentData } from "firestore-type";
```

Focused subpath imports:

```ts
import { defineModel, readDomain } from "firestore-type/core";
import { dateFromTimestamp, timestampFromDate } from "firestore-type/time";
import { readDocumentDomain } from "firestore-type/adapters/firebase-client";
import { readDocumentDomain as readAdminDocumentDomain } from "firestore-type/adapters/firebase-admin";
```

## Development

```bash
pnpm install
pnpm test
pnpm build
```

See `docs/firestore-object-toolkit-design.md` for the design overview and `docs/user-guide.md` for additional project documentation.

The shared Task sample model now lives in `samples/shared` and is the starting point for the runnable sample apps.
