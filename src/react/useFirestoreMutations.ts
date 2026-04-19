import { useCallback, useMemo, useState } from "react";
import {
  Timestamp,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  type CollectionReference,
  type DocumentData as FirebaseDocumentData,
  type SetOptions,
} from "firebase/firestore";

import type { ModelSpec, PersistedBase, ToTimestamp } from "../core/types.js";
import { normalizeErrorMessage, stripUndefinedFields } from "./utils.js";

export interface UseFirestoreMutationsOptions<
  Domain,
  PersistedLatest extends PersistedBase,
> {
  collection: CollectionReference<FirebaseDocumentData> | null;
  model: ModelSpec<Domain, PersistedLatest>;
  toTimestamp?: ToTimestamp;
  stripUndefined?: boolean;
}

export interface UseFirestoreMutationsResult<
  Domain,
  PersistedLatest extends PersistedBase,
> {
  pending: boolean;
  error: string | null;
  actionDocumentId: string | null;
  clearError: () => void;
  create: (domain: Domain) => Promise<string>;
  setById: (id: string, domain: Domain, options?: SetOptions) => Promise<void>;
  updateById: (id: string, patch: Partial<Domain>) => Promise<void>;
  setPersistedById: (
    id: string,
    value: PersistedLatest,
    options?: SetOptions,
  ) => Promise<void>;
  updatePersistedById: (
    id: string,
    patch: Partial<PersistedLatest>,
  ) => Promise<void>;
  deleteById: (id: string) => Promise<void>;
}

function getMissingCollectionError(): Error {
  return new Error("Firestore collection reference is required for mutations");
}

function getMissingPartialPersistedError(): Error {
  return new Error(
    "Model is missing toPartialPersisted. Provide toPartialPersisted or use updatePersistedById.",
  );
}

export function useFirestoreMutations<
  Domain,
  PersistedLatest extends PersistedBase,
>(
  options: UseFirestoreMutationsOptions<Domain, PersistedLatest>,
): UseFirestoreMutationsResult<Domain, PersistedLatest> {
  const {
    collection,
    model,
    toTimestamp = Timestamp.fromDate,
    stripUndefined = true,
  } = options;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionDocumentId, setActionDocumentId] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const toPersistedData = useCallback(
    (domain: Domain): PersistedLatest => {
      const persisted = model.toPersisted(domain, toTimestamp);
      return stripUndefined
        ? (stripUndefinedFields(
            persisted as FirebaseDocumentData,
          ) as PersistedLatest)
        : persisted;
    },
    [model, toTimestamp, stripUndefined],
  );

  const toPersistedPatch = useCallback(
    (patch: Partial<Domain>): Partial<PersistedLatest> => {
      if (model.toPartialPersisted === undefined) {
        throw getMissingPartialPersistedError();
      }

      const persistedPatch = model.toPartialPersisted(patch, toTimestamp);
      return stripUndefined
        ? (stripUndefinedFields(
            persistedPatch as FirebaseDocumentData,
          ) as Partial<PersistedLatest>)
        : persistedPatch;
    },
    [model, toTimestamp, stripUndefined],
  );

  const normalizePersistedPatch = useCallback(
    (patch: Partial<PersistedLatest>): Partial<PersistedLatest> =>
      stripUndefined
        ? (stripUndefinedFields(
            patch as FirebaseDocumentData,
          ) as Partial<PersistedLatest>)
        : patch,
    [stripUndefined],
  );

  const runMutation = useCallback(
    async <T>(
      actionId: string | null,
      action: () => Promise<T>,
      fallback: string,
    ): Promise<T> => {
      setPending(true);
      setActionDocumentId(actionId);
      setError(null);

      try {
        return await action();
      } catch (nextError) {
        setError(normalizeErrorMessage(nextError, fallback));
        throw nextError;
      } finally {
        setPending(false);
        setActionDocumentId(null);
      }
    },
    [],
  );

  const create = useCallback(
    async (domain: Domain): Promise<string> => {
      if (collection === null) {
        const missingCollectionError = getMissingCollectionError();
        setError(missingCollectionError.message);
        throw missingCollectionError;
      }

      return runMutation(
        null,
        async () => {
          const persisted = toPersistedData(domain);
          const created = await addDoc(
            collection,
            persisted as FirebaseDocumentData,
          );
          return created.id;
        },
        "Failed to create Firestore document",
      );
    },
    [collection, toPersistedData, runMutation],
  );

  const setById = useCallback(
    async (id: string, domain: Domain, options?: SetOptions): Promise<void> => {
      if (collection === null) {
        const missingCollectionError = getMissingCollectionError();
        setError(missingCollectionError.message);
        throw missingCollectionError;
      }

      await runMutation(
        id,
        async () => {
          const persisted = toPersistedData(domain);
          if (options === undefined) {
            await setDoc(
              doc(collection, id),
              persisted as FirebaseDocumentData,
            );
            return;
          }

          await setDoc(
            doc(collection, id),
            persisted as FirebaseDocumentData,
            options,
          );
        },
        "Failed to write Firestore document",
      );
    },
    [collection, toPersistedData, runMutation],
  );

  const setPersistedById = useCallback(
    async (id: string, value: PersistedLatest, options?: SetOptions): Promise<void> => {
      if (collection === null) {
        const missingCollectionError = getMissingCollectionError();
        setError(missingCollectionError.message);
        throw missingCollectionError;
      }

      await runMutation(
        id,
        async () => {
          const persisted = normalizePersistedPatch(value) as FirebaseDocumentData;
          if (options === undefined) {
            await setDoc(doc(collection, id), persisted);
            return;
          }

          await setDoc(doc(collection, id), persisted, options);
        },
        "Failed to write Firestore document",
      );
    },
    [collection, normalizePersistedPatch, runMutation],
  );

  const updateById = useCallback(
    async (id: string, patch: Partial<Domain>): Promise<void> => {
      if (collection === null) {
        const missingCollectionError = getMissingCollectionError();
        setError(missingCollectionError.message);
        throw missingCollectionError;
      }

      await runMutation(
        id,
        async () => {
          const nextPatch = toPersistedPatch(patch);
          await updateDoc(doc(collection, id), nextPatch as FirebaseDocumentData);
        },
        "Failed to update Firestore document",
      );
    },
    [collection, toPersistedPatch, runMutation],
  );

  const updatePersistedById = useCallback(
    async (id: string, patch: Partial<PersistedLatest>): Promise<void> => {
      if (collection === null) {
        const missingCollectionError = getMissingCollectionError();
        setError(missingCollectionError.message);
        throw missingCollectionError;
      }

      await runMutation(
        id,
        async () => {
          const nextPatch = normalizePersistedPatch(patch);

          await updateDoc(
            doc(collection, id),
            nextPatch as FirebaseDocumentData,
          );
        },
        "Failed to update Firestore document",
      );
    },
    [collection, normalizePersistedPatch, runMutation],
  );

  const deleteById = useCallback(
    async (id: string): Promise<void> => {
      if (collection === null) {
        const missingCollectionError = getMissingCollectionError();
        setError(missingCollectionError.message);
        throw missingCollectionError;
      }

      await runMutation(
        id,
        async () => {
          await deleteDoc(doc(collection, id));
        },
        "Failed to delete Firestore document",
      );
    },
    [collection, runMutation],
  );

  return useMemo(
    () => ({
      pending,
      error,
      actionDocumentId,
      clearError,
      create,
      setById,
      updateById,
      setPersistedById,
      updatePersistedById,
      deleteById,
    }),
    [
      pending,
      error,
      actionDocumentId,
      clearError,
      create,
      setById,
      updateById,
      setPersistedById,
      updatePersistedById,
      deleteById,
    ],
  );
}
