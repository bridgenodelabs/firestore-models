/**
 * firestore-type
 *
 * Shared Firestore type definitions and utilities usable in both
 * browser (Firebase Web SDK) and Node.js (Firebase Admin SDK) environments.
 */

/**
 * Represents a Firestore document's data as a plain object.
 */
export type DocumentData = Record<string, unknown>;

/**
 * A typed wrapper around a Firestore document snapshot.
 *
 * @template T - The shape of the document's data.
 */
export interface TypedDocumentSnapshot<T extends DocumentData> {
  id: string;
  data(): T | undefined;
  exists: boolean;
}

/**
 * A typed wrapper around a Firestore collection / query snapshot.
 *
 * @template T - The shape of each document's data.
 */
export interface TypedQuerySnapshot<T extends DocumentData> {
  docs: TypedDocumentSnapshot<T>[];
  empty: boolean;
  size: number;
}

/**
 * Utility: extract the typed data from a document snapshot and narrow out
 * undefined (i.e. assert the document exists).
 *
 * @throws {Error} if the document does not exist.
 */
export function getDocumentData<T extends DocumentData>(
  snapshot: TypedDocumentSnapshot<T>
): T {
  if (!snapshot.exists) {
    throw new Error(`Document "${snapshot.id}" does not exist.`);
  }
  const data = snapshot.data();
  if (data === undefined) {
    throw new Error(`Document "${snapshot.id}" returned no data.`);
  }
  return data;
}
