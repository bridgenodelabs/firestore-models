import { useEffect, useMemo, useState } from "react";
import {
  onSnapshot,
  type CollectionReference,
  type DocumentData as FirebaseDocumentData,
  type Query,
} from "firebase/firestore";

import type { ModelSpec, PersistedBase } from "../core/types.js";
import type { DocumentData as LibraryDocumentData } from "../types.js";
import {
  readDocumentDomain,
  type BrowserDocumentSnapshot,
} from "../adapters/firebase-client/index.js";
import { normalizeErrorMessage } from "./utils.js";

export interface UseFirestoreCollectionDomainOptions<
  Domain extends object,
  PersistedLatest extends PersistedBase,
  Item,
> {
  source:
    | Query<FirebaseDocumentData>
    | CollectionReference<FirebaseDocumentData>
    | null;
  model: ModelSpec<Domain, PersistedLatest>;
  enabled?: boolean;
  mapDocument?: (value: { id: string; domain: Domain }) => Item;
}

export interface UseFirestoreCollectionDomainResult<Item> {
  documents: Item[];
  loading: boolean;
  error: string | null;
}

function defaultMapDocument<Domain extends object>(value: {
  id: string;
  domain: Domain;
}): Domain & { id: string } {
  return {
    id: value.id,
    ...value.domain,
  };
}

export function useFirestoreCollectionDomain<
  Domain extends object,
  PersistedLatest extends PersistedBase,
  Item = Domain & { id: string },
>(
  options: UseFirestoreCollectionDomainOptions<Domain, PersistedLatest, Item>,
): UseFirestoreCollectionDomainResult<Item> {
  const { source, model, enabled = true, mapDocument } = options;
  const [documents, setDocuments] = useState<Item[]>([]);
  const [loading, setLoading] = useState(enabled && source !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (source === null) {
      setDocuments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    return onSnapshot(
      source,
      (snapshot) => {
        try {
          const nextDocuments = snapshot.docs.map((docSnapshot) => {
            const domain = readDocumentDomain(
              docSnapshot as unknown as BrowserDocumentSnapshot<LibraryDocumentData>,
              model,
            );

            return (mapDocument ?? defaultMapDocument)({
              id: docSnapshot.id,
              domain,
            }) as Item;
          });

          setDocuments(nextDocuments);
          setLoading(false);
        } catch (nextError) {
          setError(
            normalizeErrorMessage(
              nextError,
              "Failed to map Firestore collection snapshot",
            ),
          );
          setLoading(false);
        }
      },
      (nextError) => {
        setError(
          normalizeErrorMessage(
            nextError,
            "Failed to subscribe to Firestore collection",
          ),
        );
        setLoading(false);
      },
    );
  }, [enabled, source, model, mapDocument]);

  return useMemo(
    () => ({
      documents,
      loading,
      error,
    }),
    [documents, loading, error],
  );
}
