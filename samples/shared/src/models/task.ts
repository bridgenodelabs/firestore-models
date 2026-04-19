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

export const taskPriorityValues = ["low", "medium", "high"] as const;

export type TaskPriority = (typeof taskPriorityValues)[number];

export interface Task {
  title: string;
  done: boolean;
  dueAt?: Date;
  priority: TaskPriority;
}

export interface TaskPersistedV0 extends PersistedBase {
  schemaVersion: 0;
  title: string;
  completed: boolean;
  dueDate?: TimestampLike;
}

export interface TaskPersistedV1 extends PersistedBase {
  schemaVersion: 1;
  title: string;
  done: boolean;
  dueAt?: TimestampLike;
  priority: TaskPriority;
}

export const validateTaskPersisted = createValidator<
  TaskPersistedV0 | TaskPersistedV1
>((value) => {
  assertObject(value, "Task document must be an object");
  assertNumber(
    value.schemaVersion,
    "Task document schemaVersion must be numeric",
  );

  if (typeof value.title !== "string") {
    throw new Error("Task document title must be a string");
  }

  if (value.schemaVersion === 0) {
    if (typeof value.completed !== "boolean") {
      throw new Error("Task v0 document must include completed: boolean");
    }

    if (value.dueDate !== undefined) {
      if (value.dueDate === null || typeof value.dueDate !== "object") {
        throw new Error("Task v0 dueDate must be a timestamp-like object");
      }

      dateFromTimestamp(value.dueDate as TimestampLike);
    }

    return;
  }

  if (value.schemaVersion === 1) {
    if (typeof value.done !== "boolean") {
      throw new Error("Task v1 document must include done: boolean");
    }

    if (!taskPriorityValues.includes(value.priority as TaskPriority)) {
      throw new Error("Task v1 document priority must be low, medium, or high");
    }

    if (value.dueAt !== undefined) {
      if (value.dueAt === null || typeof value.dueAt !== "object") {
        throw new Error("Task v1 dueAt must be a timestamp-like object");
      }

      dateFromTimestamp(value.dueAt as TimestampLike);
    }

    return;
  }

  throw new Error(`Unsupported Task schemaVersion ${value.schemaVersion}`);
});

export function migrateTaskV0ToV1(doc: TaskPersistedV0): TaskPersistedV1 {
  return {
    schemaVersion: 1,
    title: doc.title,
    done: doc.completed,
    dueAt: doc.dueDate,
    priority: "medium",
  };
}

export const taskModel = defineModel<Task, TaskPersistedV1>({
  currentVersion: 1,
  validatePersisted: validateTaskPersisted,
  migrations: {
    0: migrateTaskV0ToV1,
  },
  toPersisted: (task, toTimestamp) => {
    if (task.dueAt && !toTimestamp) {
      throw new Error("toTimestamp is required when persisting Task.dueAt");
    }

    return {
      schemaVersion: 1,
      title: task.title,
      done: task.done,
      dueAt: task.dueAt
        ? timestampFromDate(task.dueAt, toTimestamp!)
        : undefined,
      priority: task.priority,
    };
  },
  toPartialPersisted: (patch, toTimestamp) => {
    if (patch.dueAt !== undefined && patch.dueAt && !toTimestamp) {
      throw new Error("toTimestamp is required when persisting Task.dueAt");
    }

    return {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.done !== undefined ? { done: patch.done } : {}),
      ...(patch.dueAt !== undefined
        ? {
            dueAt: patch.dueAt
              ? timestampFromDate(patch.dueAt, toTimestamp!)
              : patch.dueAt,
          }
        : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    };
  },
  fromPersisted: (doc) => ({
    title: doc.title,
    done: doc.done,
    dueAt: doc.dueAt ? dateFromTimestamp(doc.dueAt) : undefined,
    priority: doc.priority,
  }),
});
