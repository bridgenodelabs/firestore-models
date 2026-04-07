// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { defineModel } from "../core/defineModel.js";
import { useFirestoreDocumentDomain } from "./useFirestoreDocumentDomain.js";

const onSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("firebase/firestore", () => ({
  onSnapshot: onSnapshotMock,
}));

describe("useFirestoreDocumentDomain", () => {
  beforeEach(() => {
    onSnapshotMock.mockReset();
  });

  it("returns null when the document does not exist", async () => {
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
        id: "missing-doc",
        exists: () => false,
        data: () => undefined,
      });
      return () => {
        // No-op unsubscribe for tests.
      };
    });

    const { result } = renderHook(() =>
      useFirestoreDocumentDomain({
        source,
        model,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.document).toBeNull();
  });

  it("hydrates an existing document", async () => {
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
        id: "doc-1",
        exists: () => true,
        data: () => ({ schemaVersion: 1, name: "Lin" }),
      });
      return () => {
        // No-op unsubscribe for tests.
      };
    });

    const { result } = renderHook(() =>
      useFirestoreDocumentDomain({
        source,
        model,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.document).toEqual({
      id: "doc-1",
      name: "Lin",
    });
  });
});
