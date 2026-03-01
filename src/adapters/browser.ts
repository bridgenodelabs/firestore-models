/**
 * Browser adapter for firestore-type.
 *
 * Provides helpers for working with the Firebase Web SDK
 * (`firebase/firestore`) on the client side.
 *
 * Usage:
 *   import { toTypedSnapshot } from "firestore-type/adapters/browser";
 */

import type {
  DocumentData,
  TypedDocumentSnapshot,
  TypedQuerySnapshot,
} from "../index.js";

/**
 * Minimal structural interface matching `DocumentSnapshot` from the
 * Firebase Web SDK (`firebase/firestore`).
 */
export interface BrowserDocumentSnapshot<T> {
  id: string;
  exists(): boolean;
  data(): T | undefined;
}

/**
 * Minimal structural interface matching `QuerySnapshot` from the
 * Firebase Web SDK (`firebase/firestore`).
 */
export interface BrowserQuerySnapshot<T> {
  docs: BrowserDocumentSnapshot<T>[];
  empty: boolean;
  size: number;
}

/**
 * Wrap a Firebase Web SDK `DocumentSnapshot` in the library's
 * `TypedDocumentSnapshot` interface.
 */
export function toTypedSnapshot<T extends DocumentData>(
  snapshot: BrowserDocumentSnapshot<T>
): TypedDocumentSnapshot<T> {
  return {
    id: snapshot.id,
    exists: snapshot.exists(),
    data: () => snapshot.data(),
  };
}

/**
 * Wrap a Firebase Web SDK `QuerySnapshot` in the library's
 * `TypedQuerySnapshot` interface.
 */
export function toTypedQuerySnapshot<T extends DocumentData>(
  snapshot: BrowserQuerySnapshot<T>
): TypedQuerySnapshot<T> {
  return {
    docs: snapshot.docs.map((d) => toTypedSnapshot<T>(d)),
    empty: snapshot.empty,
    size: snapshot.size,
  };
}
