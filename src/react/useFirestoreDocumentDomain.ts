import { useEffect, useMemo, useState } from "react";
import {
  onSnapshot,
  type DocumentData as FirebaseDocumentData,
  type DocumentReference,
} from "firebase/firestore";

import type { ModelSpec, PersistedBase } from "../core/types.js";
import type { DocumentData as LibraryDocumentData } from "../types.js";
import {
  readDocumentDomain,
  type BrowserDocumentSnapshot,
} from "../adapters/firebase-client/index.js";
import { normalizeErrorMessage } from "./utils.js";

export interface UseFirestoreDocumentDomainOptions<
  Domain extends object,
  PersistedLatest extends PersistedBase,
  Item,
> {
  source: DocumentReference<FirebaseDocumentData> | null;
  model: ModelSpec<Domain, PersistedLatest>;
  enabled?: boolean;
  mapDocument?: (value: { id: string; domain: Domain }) => Item;
}

export interface UseFirestoreDocumentDomainResult<Item> {
  document: Item | null;
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

export function useFirestoreDocumentDomain<
  Domain extends object,
  PersistedLatest extends PersistedBase,
  Item = Domain & { id: string },
>(
  options: UseFirestoreDocumentDomainOptions<Domain, PersistedLatest, Item>,
): UseFirestoreDocumentDomainResult<Item> {
  const { source, model, enabled = true, mapDocument } = options;
  const [document, setDocument] = useState<Item | null>(null);
  const [loading, setLoading] = useState(enabled && source !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (source === null) {
      setDocument(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    return onSnapshot(
      source,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDocument(null);
          setLoading(false);
          return;
        }

        try {
          const domain = readDocumentDomain(
            snapshot as unknown as BrowserDocumentSnapshot<LibraryDocumentData>,
            model,
          );

          setDocument(
            ((mapDocument ?? defaultMapDocument)({
              id: snapshot.id,
              domain,
            }) as Item) ?? null,
          );
          setLoading(false);
        } catch (nextError) {
          setError(
            normalizeErrorMessage(
              nextError,
              "Failed to map Firestore document snapshot",
            ),
          );
          setLoading(false);
        }
      },
      (nextError) => {
        setError(
          normalizeErrorMessage(
            nextError,
            "Failed to subscribe to Firestore document",
          ),
        );
        setLoading(false);
      },
    );
  }, [enabled, source, model, mapDocument]);

  return useMemo(
    () => ({
      document,
      loading,
      error,
    }),
    [document, loading, error],
  );
}
