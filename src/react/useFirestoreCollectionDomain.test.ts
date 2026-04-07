// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { defineModel } from "../core/defineModel.js";
import { useFirestoreCollectionDomain } from "./useFirestoreCollectionDomain.js";

const onSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("firebase/firestore", () => ({
  onSnapshot: onSnapshotMock,
}));

describe("useFirestoreCollectionDomain", () => {
  beforeEach(() => {
    onSnapshotMock.mockReset();
  });

  it("hydrates and migrates collection documents", async () => {
    const source = {} as never;
    const model = defineModel({
      currentVersion: 1,
      toPersisted: (domain: { name: string }) => ({
        schemaVersion: 1 as const,
        name: domain.name,
      }),
      fromPersisted: (persisted) => ({ name: persisted.name }),
      migrations: {
        0: (persisted: { schemaVersion: 0; oldName: string }) => ({
          schemaVersion: 1 as const,
          name: persisted.oldName,
        }),
      },
    });

    onSnapshotMock.mockImplementation((_source, onNext) => {
      onNext({
        docs: [
          {
            id: "doc-1",
            exists: () => true,
            data: () => ({ schemaVersion: 0, oldName: "Ada" }),
          },
        ],
      });
      return () => {
        // No-op unsubscribe for tests.
      };
    });

    const { result } = renderHook(() =>
      useFirestoreCollectionDomain({
        source,
        model,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.documents).toEqual([
      {
        id: "doc-1",
        name: "Ada",
      },
    ]);
  });

  it("surfaces migration and validation failures", async () => {
    const source = {} as never;
    const model = defineModel({
      currentVersion: 1,
      toPersisted: (domain: { name: string }) => ({
        schemaVersion: 1 as const,
        name: domain.name,
      }),
      fromPersisted: (persisted) => ({ name: persisted.name }),
    });

    onSnapshotMock.mockImplementation((_source, onNext) => {
      onNext({
        docs: [
          {
            id: "doc-2",
            exists: () => true,
            data: () => ({ schemaVersion: 0, oldName: "Grace" }),
          },
        ],
      });
      return () => {
        // No-op unsubscribe for tests.
      };
    });

    const { result } = renderHook(() =>
      useFirestoreCollectionDomain({
        source,
        model,
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toContain(
        "Missing migration for schemaVersion 0",
      );
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.documents).toEqual([]);
  });
});
