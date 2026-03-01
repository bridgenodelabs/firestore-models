/**
 * Node.js adapter for firestore-type.
 *
 * Provides helpers for working with the Firebase Admin SDK
 * (`firebase-admin/firestore`) on the server side.
 *
 * Usage:
 *   import { toTypedSnapshot } from "firestore-type/adapters/node";
 */

import type {
  DocumentData,
  TypedDocumentSnapshot,
  TypedQuerySnapshot,
} from "../index.js";

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

/**
 * Wrap a Firebase Admin SDK `DocumentSnapshot` in the library's
 * `TypedDocumentSnapshot` interface.
 */
export function toTypedSnapshot<T extends DocumentData>(
  snapshot: AdminDocumentSnapshot<T>
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
  snapshot: AdminQuerySnapshot<T>
): TypedQuerySnapshot<T> {
  return {
    docs: snapshot.docs.map((d) => toTypedSnapshot<T>(d)),
    empty: snapshot.empty,
    size: snapshot.size,
  };
}
