/**
 * Firebase Admin adapter for firestore-type.
 *
 * Provides helpers for working with the Firebase Admin SDK
 * (`firebase-admin/firestore`) on the server side.
 *
 * Usage:
 *   import { toTypedSnapshot, readDocumentDomain } from "firestore-type/adapters/firebase-admin";
 */

import type { DocumentData, TypedDocumentSnapshot, TypedQuerySnapshot } from '../../types.js';
import type { ModelSpec, PersistedBase, ToTimestamp } from '../../core/types.js';
import { readDomain } from '../../core/migrate.js';

/**
 * Minimal structural interface matching `DocumentSnapshot` from the
 * Firebase Admin SDK (`firebase-admin/firestore`).
 */
export interface AdminDocumentSnapshot<T> {
  id: string;
  exists: boolean;
  data(): T | undefined;
}

/**
 * Minimal structural interface matching `QuerySnapshot` from the
 * Firebase Admin SDK (`firebase-admin/firestore`).
 */
export interface AdminQuerySnapshot<T> {
  docs: AdminDocumentSnapshot<T>[];
  empty: boolean;
  size: number;
}

export interface AdminSetOptions {
  merge?: boolean;
}

export interface AdminDocumentWriter<T> {
  set(data: T): Promise<unknown>;
  set(data: T, options: AdminSetOptions): Promise<unknown>;
  update(data: Partial<T>): Promise<unknown>;
}

function getMissingPartialPersistedError(): Error {
  return new Error(
    'Model is missing toPartialPersisted. Provide toPartialPersisted or use updateDocumentPersisted.',
  );
}

/**
 * Wrap a Firebase Admin SDK `DocumentSnapshot` in the library's
 * `TypedDocumentSnapshot` interface.
 */
export function toTypedSnapshot<T extends DocumentData>(
  snapshot: AdminDocumentSnapshot<T>,
): TypedDocumentSnapshot<T> {
  return {
    id: snapshot.id,
    exists: snapshot.exists,
    data: () => snapshot.data(),
  };
}

/**
 * Wrap a Firebase Admin SDK `QuerySnapshot` in the library's
 * `TypedQuerySnapshot` interface.
 */
export function toTypedQuerySnapshot<T extends DocumentData>(
  snapshot: AdminQuerySnapshot<T>,
): TypedQuerySnapshot<T> {
  return {
    docs: snapshot.docs.map((d) => toTypedSnapshot<T>(d)),
    empty: snapshot.empty,
    size: snapshot.size,
  };
}

/**
 * Read a domain object from a Firebase Admin SDK `DocumentSnapshot`,
 * running validation and schema migration as needed.
 *
 * Combines snapshot unwrapping with the full migration-on-read flow:
 * raw → validate → migrate → hydrate domain object.
 *
 * @throws {Error} if the document does not exist or validation/migration fails.
 */
export function readDocumentDomain<Domain, PersistedLatest extends PersistedBase>(
  snapshot: AdminDocumentSnapshot<DocumentData>,
  spec: ModelSpec<Domain, PersistedLatest>,
): Domain {
  if (!snapshot.exists) {
    throw new Error(`Document "${snapshot.id}" does not exist.`);
  }
  const raw = snapshot.data();
  if (raw === undefined) {
    throw new Error(`Document "${snapshot.id}" returned no data.`);
  }
  return readDomain(raw, spec);
}

export async function createDocumentDomain<Domain, PersistedLatest extends PersistedBase>(
  ref: AdminDocumentWriter<PersistedLatest>,
  domain: Domain,
  spec: ModelSpec<Domain, PersistedLatest>,
  options?: { toTimestamp?: ToTimestamp },
): Promise<void> {
  const persisted = spec.toPersisted(domain, options?.toTimestamp);
  await ref.set(persisted);
}

export async function setDocumentDomain<Domain, PersistedLatest extends PersistedBase>(
  ref: AdminDocumentWriter<PersistedLatest>,
  domain: Domain,
  spec: ModelSpec<Domain, PersistedLatest>,
  options?: { merge?: boolean; toTimestamp?: ToTimestamp },
): Promise<void> {
  const persisted = spec.toPersisted(domain, options?.toTimestamp);
  if (options?.merge === undefined) {
    await ref.set(persisted);
    return;
  }

  await ref.set(persisted, { merge: options.merge });
}

export async function updateDocumentDomain<Domain, PersistedLatest extends PersistedBase>(
  ref: AdminDocumentWriter<PersistedLatest>,
  patch: Partial<Domain>,
  spec: ModelSpec<Domain, PersistedLatest>,
  options?: { toTimestamp?: ToTimestamp },
): Promise<void> {
  if (spec.toPartialPersisted === undefined) {
    throw getMissingPartialPersistedError();
  }

  await ref.update(spec.toPartialPersisted(patch, options?.toTimestamp));
}

export async function updateDocumentPersisted<PersistedLatest extends PersistedBase>(
  ref: AdminDocumentWriter<PersistedLatest>,
  patch: Partial<PersistedLatest>,
): Promise<void> {
  await ref.update(patch);
}
