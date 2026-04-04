import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import {
  collection,
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

dotenv.config({ path: ".env.local" });
dotenv.config();

const requiredEnvVars = [
  { base: "FIREBASE_API_KEY", alias: "VITE_FIREBASE_API_KEY" },
  { base: "FIREBASE_AUTH_DOMAIN", alias: "VITE_FIREBASE_AUTH_DOMAIN" },
  { base: "FIREBASE_PROJECT_ID", alias: "VITE_FIREBASE_PROJECT_ID" },
  { base: "FIREBASE_APP_ID", alias: "VITE_FIREBASE_APP_ID" },
] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];

function readNullableEnv(base: string, alias?: string): string | undefined {
  const rawValue =
    process.env[base] ?? (alias ? process.env[alias] : undefined);
  if (rawValue === undefined) {
    return undefined;
  }

  const trimmed = String(rawValue).trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const envValues = requiredEnvVars.reduce<Record<string, string>>(
  (acc, { base, alias }) => {
    const value = readNullableEnv(base, alias);
    if (value !== undefined) {
      acc[base] = value;
    }
    return acc;
  },
  {},
);

const missingRequiredEnvVars = requiredEnvVars
  .filter(({ base }) => !envValues[base])
  .map(({ base }) => base);

export const firebaseConfigError: string | null =
  missingRequiredEnvVars.length > 0
    ? `Missing required environment variables: ${missingRequiredEnvVars.join(", ")}`
    : null;

const firebaseApp =
  firebaseConfigError === null
    ? initializeApp({
        apiKey: envValues.FIREBASE_API_KEY,
        authDomain: envValues.FIREBASE_AUTH_DOMAIN,
        projectId: envValues.FIREBASE_PROJECT_ID,
        appId: envValues.FIREBASE_APP_ID,
        storageBucket: readNullableEnv(
          "FIREBASE_STORAGE_BUCKET",
          "VITE_FIREBASE_STORAGE_BUCKET",
        ),
        messagingSenderId: readNullableEnv(
          "FIREBASE_MESSAGING_SENDER_ID",
          "VITE_FIREBASE_MESSAGING_SENDER_ID",
        ),
        measurementId: readNullableEnv(
          "FIREBASE_MEASUREMENT_ID",
          "VITE_FIREBASE_MEASUREMENT_ID",
        ),
      })
    : null;

export const db: Firestore | null =
  firebaseApp === null ? null : getFirestore(firebaseApp);

const emulatorHost =
  process.env.FIREBASE_EMULATOR_HOST ??
  process.env.VITE_FIREBASE_EMULATOR_HOST ??
  "127.0.0.1";
const emulatorPort = Number(
  process.env.FIREBASE_EMULATOR_PORT ??
    process.env.VITE_FIREBASE_EMULATOR_PORT ??
    8080,
);
const emulatorFlag =
  process.env.USE_FIREBASE_EMULATOR ?? process.env.VITE_USE_FIREBASE_EMULATOR;
const shouldUseEmulator =
  emulatorFlag === "true" || process.env.NODE_ENV !== "production";

let emulatorConnected = false;

if (shouldUseEmulator && !emulatorConnected && db !== null) {
  connectFirestoreEmulator(db, emulatorHost, emulatorPort);
  emulatorConnected = true;
}

export const projectsCollection =
  db === null ? null : collection(db, "projects");

function getEmulatorMessage(): string {
  return firebaseConfigError ?? "Firebase configuration is invalid";
}

export function requireFirestore(): Firestore {
  if (db === null) {
    throw new Error(getEmulatorMessage());
  }

  return db;
}

export function requireProjectsCollection() {
  if (projectsCollection === null) {
    throw new Error(getEmulatorMessage());
  }

  return projectsCollection;
}

export function tasksCollectionForProject(projectId: string) {
  const store = db;

  if (store === null) {
    throw new Error(getEmulatorMessage());
  }

  return collection(store, "projects", projectId, "tasks");
}
