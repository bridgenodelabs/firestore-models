import {
  doc,
  getDoc,
  getDocs,
  runTransaction,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import {
  readDocumentDomain,
  type BrowserDocumentSnapshot,
} from "firestore-type/adapters/firebase-client";

import { projectModel, type Project } from "../models/project";
import {
  taskModel,
  type Task,
  type TaskPersistedV1,
} from "../../../shared/src/models/task";
import { requireFirestore, tasksCollectionForProject } from "./firestore";

export interface TaskWithId extends Task {
  id: string;
}

export interface ProjectWithId extends Project {
  id: string;
}

export interface ProjectWithTasks extends ProjectWithId {
  tasks: TaskWithId[];
}

function toPersistedTask(task: Task): TaskPersistedV1 {
  const persisted = taskModel.toPersisted(task, Timestamp.fromDate);
  return stripUndefined(persisted);
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
}

export async function persistProjectWithTasks(
  projectId: string,
  project: Project,
  tasks: TaskWithId[],
): Promise<void> {
  const store = requireFirestore();
  const projectRef = doc(store, "projects", projectId);
  const tasksCollection = tasksCollectionForProject(projectId);

  await runTransaction(store, async (transaction) => {
    transaction.set(
      projectRef,
      projectModel.toPersisted(project, Timestamp.fromDate),
    );

    for (const task of tasks) {
      transaction.set(doc(tasksCollection, task.id), toPersistedTask(task));
    }
  });
}

export async function getProjectWithTasks(
  projectId: string,
): Promise<ProjectWithTasks> {
  const store = requireFirestore();
  const projectRef = doc(store, "projects", projectId);
  const snapshot = await getDoc(projectRef);
  const project = readDocumentDomain(
    snapshot as BrowserDocumentSnapshot<DocumentData>,
    projectModel,
  );

  const tasksSnapshot = await getDocs(tasksCollectionForProject(projectId));
  const tasks = tasksSnapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...readDocumentDomain(
      docSnapshot as BrowserDocumentSnapshot<DocumentData>,
      taskModel,
    ),
  }));

  return {
    id: projectRef.id,
    ...project,
    tasks,
  };
}
