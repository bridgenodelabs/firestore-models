import { useCallback, useMemo } from "react";

import {
  useFirestoreCollectionDomain,
  useFirestoreMutations,
} from "@bridgenodelabs/firestore-models/react";
import { query } from "firebase/firestore";

import { tasksCollection } from "../lib/firestore";
import {
  taskModel,
  type Task,
  type TaskPersistedV1,
  type TaskPriority,
} from "../models/task";

export interface TaskWithId extends Task {
  id: string;
}

export interface CreateTaskInput {
  title: string;
  dueAt?: Date;
  priority: TaskPriority;
}

interface UseTaskListResult {
  tasks: TaskWithId[];
  loading: boolean;
  error: string | null;
  mutationError: string | null;
  actionTaskId: string | null;
  create: (input: CreateTaskInput) => Promise<void>;
  toggle: (task: TaskWithId) => Promise<void>;
  remove: (taskId: string) => Promise<void>;
}

export function useTaskList(): UseTaskListResult {
  const source = useMemo(
    () => (tasksCollection === null ? null : query(tasksCollection)),
    [],
  );

  const {
    documents: tasks,
    loading,
    error,
  } = useFirestoreCollectionDomain<Task, TaskPersistedV1, TaskWithId>({
    source,
    model: taskModel,
    mapDocument: ({ id, domain }) => ({
      id,
      ...domain,
    }),
  });

  const {
    create: createDocument,
    updateById,
    deleteById,
    pending,
    error: mutationError,
    actionDocumentId,
    clearError,
  } = useFirestoreMutations({
    collection: tasksCollection,
    model: taskModel,
  });

  const create = useCallback(
    async (input: CreateTaskInput) => {
      clearError();

      const trimmedTitle = input.title.trim();
      if (!trimmedTitle) {
        throw new Error("Task title is required");
      }

      await createDocument({
        title: trimmedTitle,
        done: false,
        dueAt: input.dueAt,
        priority: input.priority,
      });
    },
    [clearError, createDocument],
  );

  const toggle = useCallback(
    async (task: TaskWithId) => {
      clearError();
      await updateById(task.id, {
        done: !task.done,
      });
    },
    [clearError, updateById],
  );

  const remove = useCallback(
    async (taskId: string) => {
      clearError();
      await deleteById(taskId);
    },
    [clearError, deleteById],
  );

  return useMemo(
    () => ({
      tasks,
      loading,
      error,
      mutationError,
      actionTaskId: pending ? actionDocumentId : null,
      create,
      toggle,
      remove,
    }),
    [
      tasks,
      loading,
      error,
      mutationError,
      pending,
      actionDocumentId,
      create,
      toggle,
      remove,
    ],
  );
}
