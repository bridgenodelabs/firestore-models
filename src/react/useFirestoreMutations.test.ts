// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { defineModel } from "../core/defineModel.js";
import { useFirestoreMutations } from "./useFirestoreMutations.js";

const addDocMock = vi.hoisted(() => vi.fn());
const setDocMock = vi.hoisted(() => vi.fn());
const updateDocMock = vi.hoisted(() => vi.fn());
const deleteDocMock = vi.hoisted(() => vi.fn());
const docMock = vi.hoisted(() => vi.fn());
const fromDateMock = vi.hoisted(() =>
  vi.fn((date: Date) => ({
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  })),
);

vi.mock("firebase/firestore", () => ({
  Timestamp: {
    fromDate: fromDateMock,
  },
  addDoc: addDocMock,
  setDoc: setDocMock,
  updateDoc: updateDocMock,
  deleteDoc: deleteDocMock,
  doc: docMock,
}));

describe("useFirestoreMutations", () => {
  beforeEach(() => {
    addDocMock.mockReset();
    setDocMock.mockReset();
    updateDocMock.mockReset();
    deleteDocMock.mockReset();
    docMock.mockReset();
    fromDateMock.mockClear();
  });

  it("converts domain values before create and strips undefined fields", async () => {
    const model = defineModel({
      currentVersion: 1,
      toPersisted: (domain: { title: string; dueAt?: Date }, toTimestamp) => ({
        schemaVersion: 1 as const,
        title: domain.title,
        dueAt: domain.dueAt ? toTimestamp?.(domain.dueAt) : undefined,
      }),
      fromPersisted: (persisted) => ({ title: persisted.title }),
    });

    addDocMock.mockResolvedValue({ id: "created-1" });

    const { result } = renderHook(() =>
      useFirestoreMutations({
        collection: { path: "tasks" } as never,
        model,
      }),
    );

    const createdId = await result.current.create({
      title: "Ship docs",
      dueAt: new Date("2026-04-04T10:00:00.000Z"),
    });

    expect(createdId).toBe("created-1");
    expect(addDocMock).toHaveBeenCalledTimes(1);
    expect(addDocMock.mock.calls[0][1]).toEqual({
      schemaVersion: 1,
      title: "Ship docs",
      dueAt: {
        seconds: 1775296800,
        nanoseconds: 0,
      },
    });
    expect(fromDateMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces operation errors and keeps API callable", async () => {
    const model = defineModel({
      currentVersion: 1,
      toPersisted: (domain: { title: string }) => ({
        schemaVersion: 1 as const,
        title: domain.title,
      }),
      fromPersisted: (persisted) => ({ title: persisted.title }),
    });

    const mutationError = new Error("permission-denied");
    addDocMock.mockRejectedValue(mutationError);

    const { result } = renderHook(() =>
      useFirestoreMutations({
        collection: { path: "tasks" } as never,
        model,
      }),
    );

    await expect(result.current.create({ title: "x" })).rejects.toThrow(
      "permission-denied",
    );
    await waitFor(() => {
      expect(result.current.error).toBe("permission-denied");
    });
  });

  it("throws with a clear error when collection is missing", async () => {
    const model = defineModel({
      currentVersion: 1,
      toPersisted: (domain: { title: string }) => ({
        schemaVersion: 1 as const,
        title: domain.title,
      }),
      fromPersisted: (persisted) => ({ title: persisted.title }),
    });

    const { result } = renderHook(() =>
      useFirestoreMutations({
        collection: null,
        model,
      }),
    );

    await expect(result.current.create({ title: "x" })).rejects.toThrow(
      "Firestore collection reference is required for mutations",
    );
  });
});
