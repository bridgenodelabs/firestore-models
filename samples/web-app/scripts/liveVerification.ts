import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { initializeApp } from "firebase/app";
import {
  Timestamp,
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  type DocumentData,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
  type DocumentReference,
} from "firebase/firestore";
import {
  type BrowserDocumentWriter,
  readDocumentDomain,
  updateDocumentDomain,
} from "@bridgenodelabs/firestore-models/adapters/firebase-client";

import {
  taskModel,
  type Task,
  type TaskPersistedV0,
  type TaskPersistedV1,
} from "../src/models/task";

type EnvMap = Record<string, string>;

function loadDotEnv(filePath: string): EnvMap {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed: EnvMap = {};
  const file = readFileSync(filePath, "utf8");

  for (const rawLine of file.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function getEnv(env: EnvMap, name: string, fallback: string): string {
  return process.env[name] ?? env[name] ?? fallback;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(message: string): void {
  console.log(`• ${message}`);
}

function toTaskWriter(
  ref: DocumentReference<DocumentData>,
): BrowserDocumentWriter<TaskPersistedV1> {
  return {
    async set(data, options?: { merge?: boolean }) {
      if (options === undefined) {
        await setDoc(ref, data);
        return;
      }

      await setDoc(ref, data, options);
    },
    async update(data) {
      await updateDoc(ref, data);
    },
  };
}

async function main(): Promise<void> {
  const envFile = resolve(process.cwd(), ".env.local");
  const env = loadDotEnv(envFile);
  const projectId = getEnv(env, "VITE_FIREBASE_PROJECT_ID", "demo-project");
  const emulatorHost = getEnv(env, "VITE_FIREBASE_EMULATOR_HOST", "127.0.0.1");
  const emulatorPort = Number(
    getEnv(env, "VITE_FIREBASE_EMULATOR_PORT", "8080"),
  );

  const app = initializeApp({
    apiKey: getEnv(env, "VITE_FIREBASE_API_KEY", "demo-api-key"),
    authDomain: getEnv(
      env,
      "VITE_FIREBASE_AUTH_DOMAIN",
      `${projectId}.firebaseapp.com`,
    ),
    projectId,
    appId: getEnv(env, "VITE_FIREBASE_APP_ID", "1:1234567890:web:abcdef123456"),
  });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, emulatorHost, emulatorPort);

  const tasks = collection(db, "tasks");
  const runId = `verify-${Date.now()}`;
  const createdDocIds: string[] = [];

  console.log(
    `Running live verification against ${emulatorHost}:${emulatorPort} (${projectId})`,
  );

  try {
    logStep("Creating a current-version task through model-owned conversion");
    const domainTask: Task = {
      title: `${runId}-current`,
      done: false,
      dueAt: new Date("2030-01-02T03:04:00.000Z"),
      priority: "high",
    };

    const persistedTask = taskModel.toPersisted(domainTask, Timestamp.fromDate);
    const createdRef = await addDoc(tasks, persistedTask);
    createdDocIds.push(createdRef.id);

    const createdSnapshot = await getDoc(createdRef);
    assert(createdSnapshot.exists(), "Expected created task to exist");

    const createdRaw = createdSnapshot.data() as TaskPersistedV1;
    assert(
      createdRaw.schemaVersion === 1,
      "Expected schemaVersion 1 on created task",
    );
    assert(createdRaw.done === false, "Expected created task done=false");
    assert(
      createdRaw.priority === "high",
      "Expected created task priority=high",
    );
    assert(
      createdRaw.dueAt instanceof Timestamp,
      "Expected created task dueAt to be a Timestamp",
    );

    logStep("Reading the current document through readDocumentDomain");
    const hydratedCurrent = readDocumentDomain(createdSnapshot, taskModel);
    assert(
      hydratedCurrent.title === domainTask.title,
      "Expected current task title to round-trip",
    );
    assert(
      hydratedCurrent.done === domainTask.done,
      "Expected current task done to round-trip",
    );
    assert(
      hydratedCurrent.priority === domainTask.priority,
      "Expected current task priority to round-trip",
    );
    assert(
      hydratedCurrent.dueAt instanceof Date,
      "Expected current task dueAt to hydrate to Date",
    );

    logStep("Seeding a legacy schemaVersion 0 document");
    const legacyDocRef = doc(tasks, `${runId}-legacy`);
    const legacyRaw: TaskPersistedV0 = {
      schemaVersion: 0,
      title: `${runId}-legacy`,
      completed: true,
      dueDate: Timestamp.fromDate(new Date("2031-05-06T07:08:00.000Z")),
    };

    await setDoc(legacyDocRef, legacyRaw);
    createdDocIds.push(legacyDocRef.id);

    const legacySnapshot = await getDoc(legacyDocRef);
    assert(legacySnapshot.exists(), "Expected legacy task to exist");

    logStep("Verifying migration-on-read for the legacy document");
    const migratedLegacy = readDocumentDomain(legacySnapshot, taskModel);
    assert(
      migratedLegacy.title === legacyRaw.title,
      "Expected migrated legacy title to match",
    );
    assert(
      migratedLegacy.done === true,
      "Expected completed:true to migrate to done:true",
    );
    assert(
      migratedLegacy.priority === "medium",
      "Expected legacy task to default to medium priority",
    );
    assert(
      migratedLegacy.dueAt instanceof Date,
      "Expected migrated legacy dueAt to hydrate to Date",
    );

    logStep("Updating the current task through a partial domain patch");
    await updateDocumentDomain(
      toTaskWriter(createdRef),
      { done: true },
      taskModel,
      { toTimestamp: Timestamp.fromDate },
    );
    const toggledSnapshot = await getDoc(createdRef);
    assert(toggledSnapshot.exists(), "Expected toggled task to exist");
    const toggledTask = readDocumentDomain(toggledSnapshot, taskModel);
    assert(toggledTask.done === true, "Expected toggled task done=true");

    logStep("Deleting verification documents");
    await Promise.all(createdDocIds.map((id) => deleteDoc(doc(tasks, id))));

    const deletedChecks = await Promise.all(
      createdDocIds.map((id) => getDoc(doc(tasks, id))),
    );
    for (const snapshot of deletedChecks) {
      assert(!snapshot.exists(), `Expected ${snapshot.id} to be deleted`);
    }

    console.log("Live verification passed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Live verification failed: ${message}`);

    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      console.error(
        "Start the Firestore emulator first: firebase emulators:start --only firestore",
      );
    }

    process.exitCode = 1;
  }
}

void main();
